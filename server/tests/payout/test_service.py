import datetime
from functools import partial
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Organization, Transaction, User
from polar.models.payout import PayoutStatus
from polar.models.transaction import TransactionType
from polar.payout.schemas import PayoutGenerateInvoice
from polar.payout.service import (
    InsufficientBalance,
    InvoiceAlreadyExists,
    MissingInvoiceBillingDetails,
    NotReadyAccount,
    PayoutNotSucceeded,
)
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.transaction.repository import PayoutTransactionRepository
from polar.transaction.service.payout import (
    PayoutTransactionService,
)
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account, create_payout
from tests.transaction.conftest import create_transaction


@pytest.fixture(autouse=True)
def payout_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=PayoutTransactionService)
    mocker.patch("polar.payout.service.payout_transaction_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.payout.service.stripe_service", new=mock)
    return mock


create_payment_transaction = partial(ro.create_payment_transaction, amount=10000)
create_refund_transaction = partial(ro.create_refund_transaction, amount=-10000)
create_balance_transaction = partial(ro.create_balance_transaction, amount=10000)


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.parametrize(
        ("currency", "balance"),
        [
            ("usd", -1000),
            ("usd", 0),
            ("usd", settings.get_minimum_payout_for_currency("usd") - 1),
            ("eur", -1000),
            ("eur", 0),
            ("eur", settings.get_minimum_payout_for_currency("eur") - 1),
        ],
    )
    async def test_insufficient_balance(
        self,
        currency: str,
        balance: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, currency=currency
        )
        await create_balance_transaction(save_fixture, account=account, amount=balance)

        with pytest.raises(InsufficientBalance):
            await payout_service.create(session, locker, account=account)

    async def test_payout_disabled_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, is_payouts_enabled=False
        )

        with pytest.raises(NotReadyAccount):
            await payout_service.create(session, locker, account=account)

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, account=account)

        assert payout.account == account
        assert payout.processor == account.account_type
        assert payout.currency == "usd"
        assert payout.amount > 0
        assert payout.fees_amount > 0
        assert payout.account_currency == "usd"
        assert payout.account_amount > 0

        payout_transaction_service_mock.create.assert_called_once()

    async def test_valid_different_currencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, country="FR", currency="eur"
        )

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction(
            account_currency="eur", account_amount=-1000
        )

        payout = await payout_service.create(session, locker, account=account)

        assert payout.account == account
        assert payout.processor == account.account_type
        assert payout.account_currency == "eur"
        assert payout.account_amount == 1000

        payout_transaction_service_mock.create.assert_called_once()

    async def test_valid_conflicting_invoice_numbers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payout = await create_payout(
            save_fixture,
            account=account,
            # Set an invoice number that would conflict with the next one
            invoice_number=f"{settings.PAYOUT_INVOICES_PREFIX}0002",
        )

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, account=account)
        await session.flush()

        assert payout.invoice_number == f"{settings.PAYOUT_INVOICES_PREFIX}0003"


@pytest.mark.asyncio
class TestEstimate:
    async def test_regular_currency(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Test that regular currencies don't have zero-decimal adjustments."""
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service.get_payout_fees",
            return_value=[],
        )

        account = await create_account(
            save_fixture, organization, user, currency="usd"
        )
        await create_balance_transaction(save_fixture, account=account, amount=12345)

        estimate = await payout_service.estimate(session, account=account)

        assert estimate.gross_amount == 12345
        assert estimate.net_amount == 12345
        assert estimate.is_zero_decimal_payout_currency is False
        assert estimate.adjusted_net_amount is None
        assert estimate.unpayable_remainder is None

    @pytest.mark.parametrize(
        "currency",
        [
            pytest.param("isk", id="ISK"),
            pytest.param("huf", id="HUF"),
            pytest.param("twd", id="TWD"),
            pytest.param("ugx", id="UGX"),
        ],
    )
    async def test_zero_decimal_currency_with_remainder(
        self,
        currency: str,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Test that zero-decimal currencies show adjustment info when there's a remainder."""
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service.get_payout_fees",
            return_value=[],
        )

        country_map = {"isk": "IS", "huf": "HU", "twd": "TW", "ugx": "UG"}
        country = country_map[currency]

        account = await create_account(
            save_fixture, organization, user, country=country, currency=currency
        )
        # Amount that will have a remainder (12345 -> 12300, remainder 45)
        await create_balance_transaction(save_fixture, account=account, amount=12345)

        estimate = await payout_service.estimate(session, account=account)

        assert estimate.gross_amount == 12345
        assert estimate.net_amount == 12345
        assert estimate.is_zero_decimal_payout_currency is True
        assert estimate.adjusted_net_amount == 12300
        assert estimate.unpayable_remainder == 45

    async def test_zero_decimal_currency_no_remainder(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Test that zero-decimal currencies don't show adjustment when amount is exact."""
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service.get_payout_fees",
            return_value=[],
        )

        account = await create_account(
            save_fixture, organization, user, country="IS", currency="isk"
        )
        # Amount that's already a multiple of 100 (no remainder)
        await create_balance_transaction(save_fixture, account=account, amount=12300)

        estimate = await payout_service.estimate(session, account=account)

        assert estimate.gross_amount == 12300
        assert estimate.net_amount == 12300
        assert estimate.is_zero_decimal_payout_currency is True
        # No adjustment needed, so these should be None
        assert estimate.adjusted_net_amount is None
        assert estimate.unpayable_remainder is None


@pytest.mark.asyncio
class TestTriggerStripePayouts:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        organization_second: Organization,
        user_second: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account_1 = await create_account(save_fixture, organization, user)
        account_2 = await create_account(save_fixture, organization_second, user_second)

        payout_1 = await create_payout(
            save_fixture,
            account=account_1,
            created_at=utc_now() - datetime.timedelta(days=14),
        )
        payout_2 = await create_payout(
            save_fixture,
            account=account_1,
            created_at=utc_now() - datetime.timedelta(days=7),
        )
        payout_3 = await create_payout(
            save_fixture,
            account=account_2,
            created_at=utc_now() - datetime.timedelta(days=7),
        )

        await payout_service.trigger_stripe_payouts(session)

        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call(
            "payout.trigger_stripe_payout", payout_id=payout_1.id
        )
        enqueue_job_mock.assert_any_call(
            "payout.trigger_stripe_payout", payout_id=payout_3.id
        )


@pytest.mark.asyncio
class TestTransferStripe:
    async def test_valid(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", destination_payment=None
        )
        account = await create_account(save_fixture, organization, user)
        payout = await create_payout(save_fixture, account=account)
        transaction = await create_transaction(
            save_fixture,
            account=account,
            type=TransactionType.payout,
            amount=-payout.amount,
            account_currency=account.currency,
            payout=payout,
        )

        await payout_service.transfer_stripe(session, payout)

        stripe_service_mock.transfer.assert_any_call(
            account.stripe_id,
            payout.amount,
            metadata={
                "payout_id": str(payout.id),
                "payout_transaction_id": str(transaction.id),
            },
            idempotency_key=f"payout-{payout.id}",
        )

        payout_transaction_repository = PayoutTransactionRepository.from_session(
            session
        )
        updated_transaction = await payout_transaction_repository.get_by_id(
            transaction.id
        )
        assert updated_transaction is not None
        assert updated_transaction.transfer_id == "STRIPE_TRANSFER_ID"


@pytest.mark.asyncio
class TestTriggerInvoiceGeneration:
    async def test_invoice_already_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, organization, user)
        payout = await create_payout(save_fixture, account=account)
        # Set invoice path
        payout.status = PayoutStatus.succeeded
        payout.invoice_path = "some/path/to/invoice.pdf"
        await save_fixture(payout)

        with pytest.raises(InvoiceAlreadyExists):
            await payout_service.trigger_invoice_generation(
                session, payout, PayoutGenerateInvoice()
            )

    async def test_payout_not_succeeded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, organization, user)
        payout = await create_payout(
            save_fixture, account=account, status=PayoutStatus.pending
        )

        with pytest.raises(PayoutNotSucceeded):
            await payout_service.trigger_invoice_generation(
                session, payout, PayoutGenerateInvoice()
            )

    async def test_missing_billing_details(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payout = await create_payout(save_fixture, account=account)
        payout.status = PayoutStatus.succeeded
        await save_fixture(payout)

        with pytest.raises(MissingInvoiceBillingDetails):
            await payout_service.trigger_invoice_generation(
                session, payout, PayoutGenerateInvoice()
            )

    async def test_duplicate_invoice_number(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture,
            organization,
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )

        # Create first payout with a specific invoice number
        invoice_number = "INVOICE-123"
        payout1 = await create_payout(
            save_fixture,
            account=account,
            invoice_number=invoice_number,
        )
        payout1.status = PayoutStatus.succeeded
        await save_fixture(payout1)

        # Create second payout
        payout2 = await create_payout(save_fixture, account=account)
        payout2.status = PayoutStatus.succeeded
        await save_fixture(payout2)

        # Try to set the same invoice number on the second payout
        with pytest.raises(PolarRequestValidationError):
            await payout_service.trigger_invoice_generation(
                session, payout2, PayoutGenerateInvoice(invoice_number=invoice_number)
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account = await create_account(
            save_fixture,
            organization,
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )

        payout = await create_payout(
            save_fixture, account=account, status=PayoutStatus.succeeded
        )

        # Test with custom invoice number
        custom_invoice_number = "CUSTOM-INVOICE-123"
        updated_payout = await payout_service.trigger_invoice_generation(
            session, payout, PayoutGenerateInvoice(invoice_number=custom_invoice_number)
        )

        # Verify invoice number was updated
        assert updated_payout is not None
        assert updated_payout.invoice_number == custom_invoice_number

        # Verify job was enqueued
        enqueue_job_mock.assert_called_once_with("payout.invoice", payout_id=payout.id)

    async def test_valid_no_custom_invoice_number(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account = await create_account(
            save_fixture,
            organization,
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )

        original_invoice_number = "POLAR-12345"
        payout = await create_payout(
            save_fixture,
            account=account,
            invoice_number=original_invoice_number,
            status=PayoutStatus.succeeded,
        )

        # Test without providing a custom invoice number
        updated_payout = await payout_service.trigger_invoice_generation(
            session, payout, PayoutGenerateInvoice()
        )

        # Verify invoice number remains unchanged
        assert updated_payout is not None
        assert updated_payout.invoice_number == original_invoice_number

        # Verify job was enqueued
        enqueue_job_mock.assert_called_once_with("payout.invoice", payout_id=payout.id)


@pytest.mark.asyncio
class TestTriggerStripePayout:
    @pytest.mark.parametrize(
        ("account_currency", "account_amount", "expected_payout_amount"),
        [
            # Zero-decimal currencies should be rounded down to nearest 100
            pytest.param("isk", 12345, 12300, id="ISK with remainder"),
            pytest.param("isk", 12300, 12300, id="ISK no remainder"),
            pytest.param("huf", 50099, 50000, id="HUF with remainder"),
            pytest.param("twd", 99999, 99900, id="TWD with remainder"),
            pytest.param("ugx", 10050, 10000, id="UGX with remainder"),
            # Non-zero-decimal currencies should not be adjusted
            pytest.param("usd", 12345, 12345, id="USD unchanged"),
            pytest.param("eur", 12345, 12345, id="EUR unchanged"),
        ],
    )
    async def test_zero_decimal_currency_adjustment(
        self,
        account_currency: str,
        account_amount: int,
        expected_payout_amount: int,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        stripe_service_mock.retrieve_balance.return_value = (
            account_currency,
            account_amount + 1000,  # Sufficient balance
        )
        stripe_service_mock.create_payout.return_value = SimpleNamespace(
            id="STRIPE_PAYOUT_ID"
        )

        # Use a country that matches the currency for realistic test
        country_map = {"isk": "IS", "huf": "HU", "twd": "TW", "ugx": "UG"}
        country = country_map.get(account_currency, "US")

        account = await create_account(
            save_fixture,
            organization,
            user,
            country=country,
            currency=account_currency,
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            account_currency=account_currency,
            account_amount=account_amount,
        )

        result = await payout_service.trigger_stripe_payout(session, payout)

        # Verify Stripe was called with the adjusted amount
        stripe_service_mock.create_payout.assert_called_once_with(
            stripe_account=account.stripe_id,
            amount=expected_payout_amount,
            currency=account_currency,
            metadata={"payout_id": str(payout.id)},
        )

        # Verify the payout's account_amount was updated if adjusted
        assert result.account_amount == expected_payout_amount
        assert result.processor_id == "STRIPE_PAYOUT_ID"

    async def test_zero_decimal_currency_zero_amount_skipped(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        """Test that a payout with amount < 100 in zero-decimal currency is skipped."""
        stripe_service_mock.retrieve_balance.return_value = ("isk", 1000)

        account = await create_account(
            save_fixture,
            organization,
            user,
            country="IS",
            currency="isk",
        )
        # Account amount of 99 will round to 0 for ISK
        payout = await create_payout(
            save_fixture,
            account=account,
            account_currency="isk",
            account_amount=99,
        )

        result = await payout_service.trigger_stripe_payout(session, payout)

        # Stripe should not be called since amount rounds to 0
        stripe_service_mock.create_payout.assert_not_called()

        # Payout should be returned unchanged (no processor_id set)
        assert result.processor_id is None
