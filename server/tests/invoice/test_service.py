from datetime import timedelta
from functools import partial

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.enums import PayoutAccountType
from polar.invoice.generator import Invoice
from polar.invoice.service import invoice as invoice_service
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Account, Customer, Order, Organization, Product, User
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payout_account


@pytest_asyncio.fixture
async def order_with_billing(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Order:
    return await create_order(
        save_fixture,
        product=product,
        customer=customer,
        billing_name="John Doe",
        billing_address=Address(country=CountryAlpha2("US")),
    )


@pytest.mark.asyncio
async def test_create_order_invoice(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> None:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        billing_name="John Doe",
        billing_address=Address(
            line1="456 Customer Ave",
            city="Los Angeles",
            state="CA",
            postal_code="90001",
            country=CountryAlpha2("US"),
        ),
        invoice_number="POLAR-0001",
    )

    invoice_path = await invoice_service.create_order_invoice(order)


@pytest.mark.asyncio
class TestComputeOrderChecksum:
    async def test_deterministic(self, order_with_billing: Order) -> None:
        assert invoice_service.compute_order_checksum(
            order_with_billing
        ) == invoice_service.compute_order_checksum(order_with_billing)

    async def test_sensitive_to_billing_name(self, order_with_billing: Order) -> None:
        before = invoice_service.compute_order_checksum(order_with_billing)

        order_with_billing.billing_name = "Jane Doe"

        assert invoice_service.compute_order_checksum(order_with_billing) != before

    async def test_sensitive_to_billing_address(
        self, order_with_billing: Order
    ) -> None:
        before = invoice_service.compute_order_checksum(order_with_billing)

        order_with_billing.billing_address = Address(country=CountryAlpha2("FR"))

        assert invoice_service.compute_order_checksum(order_with_billing) != before

    async def test_sensitive_to_customer_locale(
        self, order_with_billing: Order
    ) -> None:
        before = invoice_service.compute_order_checksum(order_with_billing)

        order_with_billing.customer.locale = "fr"

        assert invoice_service.compute_order_checksum(order_with_billing) != before

    async def test_sensitive_to_tax_id(self, order_with_billing: Order) -> None:
        before = invoice_service.compute_order_checksum(order_with_billing)

        order_with_billing.tax_id = ("FR61954506077", TaxIDFormat.eu_vat)

        assert invoice_service.compute_order_checksum(order_with_billing) != before


ten_days_ago = utc_now() - timedelta(days=10)
create_payment_transaction = partial(
    ro.create_payment_transaction, amount=10000, created_at=ten_days_ago
)
create_balance_transaction = partial(
    ro.create_balance_transaction, amount=10000, created_at=ten_days_ago
)


@pytest.mark.asyncio
class TestCreatePayoutInvoice:
    async def test_manual_payout_without_paid_at(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        # A manual payout never goes through a processor, so it has no attempt
        # and `paid_at` stays None. Invoice generation must still succeed.
        account.billing_name = "Acme Inc."
        account.billing_address = Address(country=CountryAlpha2("US"))
        await save_fixture(account)

        await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.manual
        )
        payment_transaction = await create_payment_transaction(save_fixture)
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction
        )

        payout = await payout_service.create(session, locker, organization)
        assert payout.processor == PayoutAccountType.manual
        assert payout.paid_at is None

        render_mock = mocker.patch(
            "polar.invoice.service.render_invoice_pdf", return_value=b"%PDF-1.4"
        )
        mocker.patch("polar.invoice.service.S3Service")

        invoice_path = await invoice_service.create_payout_invoice(session, payout)

        assert invoice_path is not None
        rendered_invoice: Invoice = render_mock.call_args.args[0]
        heading_labels = [
            item.label for item in (rendered_invoice.extra_heading_items or [])
        ]
        assert "Paid at" not in heading_labels
