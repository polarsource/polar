import pytest
import pytest_asyncio

from polar.invoice.service import invoice as invoice_service
from polar.kit.address import Address, CountryAlpha2
from polar.models import Customer, Order, Product
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


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
