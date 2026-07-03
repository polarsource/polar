import datetime
import uuid
from datetime import timedelta
from functools import partial
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.enums import PayoutAccountType
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Account, Organization, Payout, Transaction, User
from polar.models.organization import OrganizationStatus, PayoutAccountNotReady
from polar.models.payout import PayoutStatus
from polar.models.transaction import Processor, TransactionType
from polar.payout.repository import PayoutRepository
from polar.payout.schemas import PayoutGenerateInvoice
from polar.payout.service import (
    InsufficientBalance,
    InvoiceAlreadyExists,
    MissingInvoiceBillingDetails,
    OrganizationCannotPayout,
    PayoutCanceled,
    PayoutHeld,
    PayoutIntervalLimitReached,
    PayoutNotCancelable,
    PayoutNotSucceeded,
)
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.transaction.repository import (
    PayoutTransactionRepository,
)
from polar.transaction.service.payout import (
    PayoutTransactionService,
)
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_payout,
    create_payout_account,
)
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


ten_days_ago = utc_now() - timedelta(days=10)
create_payment_transaction = partial(
    ro.create_payment_transaction, amount=10000, created_at=ten_days_ago
)
create_refund_transaction = partial(
    ro.create_refund_transaction, amount=-10000, created_at=ten_days_ago
)
create_balance_transaction = partial(
    ro.create_balance_transaction, amount=10000, created_at=ten_days_ago
)


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.parametrize(
        ("currency", "country", "balance"),
        [
            ("usd", "US", -1000),
            ("usd", "US", 0),
            ("usd", "US", settings.get_minimum_payout("usd", "US") - 1),
            ("eur", "FR", -1000),
            ("eur", "FR", 0),
            ("eur", "FR", settings.get_minimum_payout("eur", "FR") - 1),
            # Country-specific minimum (Panama: $50 USD) dominates the
            # currency-based USD default ($10).
            ("usd", "PA", settings.get_minimum_payout("usd", "PA") - 1),
        ],
    )
    async def test_insufficient_balance(
        self,
        currency: str,
        country: str,
        balance: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, currency=currency, country=country
        )
        await create_balance_transaction(save_fixture, account=account, amount=balance)

        with pytest.raises(InsufficientBalance):
            await payout_service.create(session, locker, organization)

    async def test_missing_payout_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        with pytest.raises(PayoutAccountNotReady):
            await payout_service.create(session, locker, organization)

    async def test_disabled_payout_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture,
            organization,
            user,
            type=PayoutAccountType.stripe,
            is_payouts_enabled=False,
        )

        with pytest.raises(PayoutAccountNotReady):
            await payout_service.create(session, locker, organization)

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.CREATED,
            OrganizationStatus.DENIED,
            OrganizationStatus.OFFBOARDING,
            OrganizationStatus.BLOCKED,
        ],
    )
    async def test_organization_cannot_payout(
        self,
        status: OrganizationStatus,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        # Bypass set_status's transition validation to seed any starting status.
        organization.status = status
        organization.set_status(status)
        await save_fixture(organization)

        payout_account = await create_payout_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_2"
        )
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        with pytest.raises(OrganizationCannotPayout):
            await payout_service.create(session, locker, organization)

    @pytest.mark.parametrize(
        "status",
        [OrganizationStatus.REVIEW, OrganizationStatus.SNOOZED],
    )
    async def test_held_for_organization_under_review(
        self,
        status: OrganizationStatus,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # A REVIEW/SNOOZED org can request a payout: it is reserved and held
        # until the org is approved, instead of being blocked.
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        organization.status = status
        organization.set_status(status)
        await save_fixture(organization)

        await create_payout_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.status == PayoutStatus.held
        assert payout.amount > 0

        # The created event fires, but the Stripe transfer is held back until
        # the org is approved.
        enqueue_job_mock.assert_called_once_with("payout.created", payout_id=payout.id)

    async def test_active_enqueues_created_and_transfer(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # The default organization fixture is ACTIVE: the payout is pending and
        # both the created event and the Stripe transfer are enqueued.
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        await create_payout_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.status == PayoutStatus.pending
        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call("payout.created", payout_id=payout.id)
        enqueue_job_mock.assert_any_call("payout.transfer", payout_id=payout.id)

    async def test_offboarded_enqueues_created_and_transfer(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # An offboarded org's payout is auto-processed (pending, not held): both
        # the created event and the Stripe transfer are enqueued.
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        organization.status = OrganizationStatus.OFFBOARDING
        organization.set_status(OrganizationStatus.OFFBOARDED)
        await save_fixture(organization)

        await create_payout_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.status == PayoutStatus.pending
        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call("payout.created", payout_id=payout.id)
        enqueue_job_mock.assert_any_call("payout.transfer", payout_id=payout.id)

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_2"
        )
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.account == account
        assert payout.payout_account == payout_account
        assert payout.processor == payout_account.type
        assert payout.currency == "usd"
        assert payout.amount > 0
        assert payout.fees_amount > 0
        assert payout.account_currency == "usd"
        assert payout.account_amount > 0

        payout_transaction_service_mock.create.assert_called_once()

    async def test_available_balance_with_delay(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        now = utc_now()

        # Create an old balance transaction (8 days ago - should be available)
        payment_transaction_old = await create_payment_transaction(
            save_fixture, created_at=now - timedelta(days=8), charge_id="CHARGE_1"
        )
        balance_transaction_old = await create_balance_transaction(
            save_fixture,
            account=account,
            payment_transaction=payment_transaction_old,
            created_at=now - timedelta(days=8),
        )

        # Create a recent balance transaction (2 days ago - should NOT be available)
        payment_transaction_recent = await create_payment_transaction(
            save_fixture, created_at=now - timedelta(days=2), charge_id="CHARGE_2"
        )
        balance_transaction_recent = await create_balance_transaction(
            save_fixture,
            account=account,
            payment_transaction=payment_transaction_recent,
            created_at=now - timedelta(days=2),
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.account == account
        assert payout.payout_account == payout_account
        # The payout amount should only include the old balance (10000) that's available
        # The recent balance (10000) is excluded because it's only 2 days old (< 7 days)
        # So we expect payout amount to be based on available_balance = 10000 (from old balance only)
        assert payout.amount == 10000 - payout.fees_amount
        assert payout.account_amount == 10000 - payout.fees_amount

        payout_transaction_service_mock.create.assert_called_once()

    async def test_valid_different_currencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture,
            organization,
            user,
            type=PayoutAccountType.stripe,
            country="FR",
            currency="eur",
        )

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_2"
        )
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction(
            account_currency="eur", account_amount=-1000
        )

        payout = await payout_service.create(session, locker, organization)

        assert payout.account == account
        assert payout.payout_account == payout_account
        assert payout.processor == payout_account.type
        assert payout.account_currency == "eur"
        assert payout.account_amount == 1000

        payout_transaction_service_mock.create.assert_called_once()

    async def test_recent_payout_within_24h(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            created_at=utc_now() - datetime.timedelta(hours=1),
        )

        with pytest.raises(PayoutIntervalLimitReached):
            await payout_service.create(session, locker, organization)

    async def test_previous_payout_older_than_24h(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            created_at=utc_now() - datetime.timedelta(hours=25),
        )

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)

        assert payout.account == account

    async def test_valid_conflicting_invoice_numbers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        account: Account,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            # Set an invoice number that would conflict with the next one
            invoice_number=f"{settings.PAYOUT_INVOICES_PREFIX}0002",
            created_at=utc_now() - datetime.timedelta(hours=25),
        )

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_1"
        )
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, organization)
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
        account: Account,
        user: User,
    ) -> None:
        """Test that regular currencies return net_amount unchanged."""
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service.get_payout_fees",
            return_value=[],
        )

        await create_payout_account(save_fixture, organization, user, currency="usd")

        await create_balance_transaction(save_fixture, account=account, amount=12345)

        estimate = await payout_service.estimate(session, organization)

        assert estimate.gross_amount == 12345
        assert estimate.net_amount == 12345


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

        account_1 = await create_account(save_fixture, user)
        payout_account_1 = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        account_2 = await create_account(save_fixture, user_second)
        payout_account_2 = await create_payout_account(
            save_fixture,
            organization_second,
            user_second,
            type=PayoutAccountType.stripe,
        )

        payout_1 = await create_payout(
            save_fixture,
            account=account_1,
            payout_account=payout_account_1,
            created_at=utc_now() - datetime.timedelta(days=14),
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_2 = await create_payout(
            save_fixture,
            account=account_1,
            payout_account=payout_account_1,
            created_at=utc_now() - datetime.timedelta(days=7),
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_3 = await create_payout(
            save_fixture,
            account=account_2,
            payout_account=payout_account_2,
            created_at=utc_now() - datetime.timedelta(days=7),
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_4 = await create_payout(
            save_fixture,
            account=account_2,
            payout_account=payout_account_2,
            created_at=utc_now() - datetime.timedelta(days=7),
            status=PayoutStatus.succeeded,
        )
        # A held payout is not yet payable: even though it is the oldest payout
        # for payout_account_2, it must be skipped so payout_3 is picked instead.
        payout_held = await create_payout(
            save_fixture,
            account=account_2,
            payout_account=payout_account_2,
            created_at=utc_now() - datetime.timedelta(days=14),
            status=PayoutStatus.held,
            attempts=[],
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
class TestTriggerStripePayout:
    async def test_canceled_raises(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.canceled,
            attempts=[],
        )

        with pytest.raises(PayoutCanceled):
            await payout_service.trigger_stripe_payout(session, payout)

        stripe_service_mock.retrieve_balance.assert_not_called()
        stripe_service_mock.create_payout.assert_not_called()

    async def test_held_raises(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # A held payout (org under review) must never reach Stripe, even through
        # the manual retry/trigger path, or funds from other payouts in the same
        # Connect account could be paid out against it.
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )

        with pytest.raises(PayoutHeld):
            await payout_service.trigger_stripe_payout(session, payout)

        stripe_service_mock.retrieve_balance.assert_not_called()
        stripe_service_mock.create_payout.assert_not_called()


@pytest.mark.asyncio
class TestTransferStripe:
    @pytest.mark.parametrize(
        "status",
        [PayoutStatus.canceled, PayoutStatus.held],
    )
    async def test_skips_not_payable(
        self,
        status: PayoutStatus,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # A payout.transfer job can race a cancellation (or a rolled-back
        # release): transfer must not move funds for a canceled/held payout.
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=status,
            attempts=[],
        )

        result = await payout_service.transfer(session, payout)

        assert result.status == status
        stripe_service_mock.transfer.assert_not_called()

    async def test_skips_after_committed_cancel(
        self,
        mocker: MockerFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # A cancel that commits after the payout.transfer job was queued leaves
        # the row canceled; transfer must honor that and skip rather than pay out
        # a payout the ledger already reversed. (The task's FOR UPDATE re-read is
        # what surfaces the committed status in production.)
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service"
            ".create_payout_fees_reversal_balances"
        )
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=-payout.amount,
            account_currency=payout.account_currency,
            account_amount=-payout.account_amount,
            tax_amount=0,
            payout=payout,
            transfer_id=None,
        )
        await save_fixture(payout_transaction)
        payout_transaction_service_mock.reverse.return_value = Transaction()

        # Cancel commits first (the racing deny/block/backoffice cancel)...
        await payout_service.cancel(session, payout)
        await session.flush()

        # ...then the already-queued transfer runs and must skip.
        result = await payout_service.transfer(session, payout)

        assert result.status == PayoutStatus.canceled
        stripe_service_mock.transfer.assert_not_called()

    async def test_cancels_when_payout_account_swapped(
        self,
        mocker: MockerFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # A released hold can win the race against the swap-cancel job. Before
        # any transfer is made, transfer must notice the org now points at a
        # different payout account and cancel + refund instead of sending funds
        # to the abandoned account.
        fee_reversal_mock = mocker.patch(
            "polar.payout.service.platform_fee_transaction_service"
            ".create_payout_fees_reversal_balances"
        )
        account = await create_account(save_fixture, user)
        old_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        new_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # The org's financial account owns the payout, and its current payout
        # account is the new one (create_payout_account left it pointing there).
        organization.account = account
        await save_fixture(organization)

        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=old_payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=-payout.amount,
            account_currency=payout.account_currency,
            account_amount=-payout.account_amount,
            tax_amount=0,
            payout=payout,
            transfer_id=None,
        )
        await save_fixture(payout_transaction)
        payout_transaction_service_mock.reverse.return_value = Transaction()

        assert organization.payout_account_id == new_payout_account.id

        result = await payout_service.transfer(session, payout)

        assert result.status == PayoutStatus.canceled
        stripe_service_mock.transfer.assert_not_called()
        fee_reversal_mock.assert_called_once_with(session, payout=payout)

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
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture, account=account, payout_account=payout_account
        )
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
            payout_account.stripe_id,
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

    @pytest.mark.parametrize(
        ("account_currency", "stripe_amount", "expected_amount"),
        [
            # Zero-decimal currencies should be rounded down to nearest 100
            pytest.param("twd", 1204324, 1204300, id="TWD with remainder"),
            pytest.param("twd", 1204300, 1204300, id="TWD no remainder"),
            pytest.param("huf", 50099, 50000, id="HUF with remainder"),
            pytest.param("isk", 12345, 12300, id="ISK with remainder"),
            pytest.param("ugx", 10050, 10000, id="UGX with remainder"),
            # Regular currencies should not be adjusted
            pytest.param("eur", 12345, 12345, id="EUR unchanged"),
        ],
    )
    async def test_zero_decimal_currency_adjustment(
        self,
        account_currency: str,
        stripe_amount: int,
        expected_amount: int,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        """Test that zero-decimal currency amounts are adjusted at transfer time."""
        # Mock the transfer with a destination_payment (indicating FX conversion)
        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", destination_payment="py_123"
        )
        # Mock the charge with a balance_transaction containing the converted amount
        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            balance_transaction=SimpleNamespace(amount=stripe_amount)
        )

        country_map = {"twd": "TW", "huf": "HU", "isk": "IS", "ugx": "UG", "eur": "DE"}
        country = country_map.get(account_currency, "US")

        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture,
            organization,
            user,
            type=PayoutAccountType.stripe,
            country=country,
            currency=account_currency,
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            account_currency=account_currency,
        )
        transaction = await create_transaction(
            save_fixture,
            account=account,
            type=TransactionType.payout,
            amount=-payout.amount,
            account_currency=account_currency,
            payout=payout,
        )

        result = await payout_service.transfer_stripe(session, payout)

        # Verify the payout's account_amount was adjusted for zero-decimal currencies
        assert result.account_amount == expected_amount


@pytest.mark.asyncio
class TestCancel:
    async def test_not_cancelable(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.succeeded,
        )

        with pytest.raises(PayoutNotCancelable):
            await payout_service.cancel(session, payout)

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=payout.amount,
            account_currency=payout.account_currency,
            account_amount=payout.account_amount,
            tax_amount=0,
            pledge=None,
            issue_reward=None,
            order=None,
            paid_transactions=[],
            incurred_transactions=[],
            account_incurred_transactions=[],
            payout=payout,
            transfer_id="STRIPE_TRANSFER_ID",
        )
        await save_fixture(payout_transaction)

        payout_reversal_transaction = Transaction()
        payout_transaction_service_mock.reverse.return_value = (
            payout_reversal_transaction
        )
        stripe_service_mock.reverse_transfer.return_value = SimpleNamespace(
            id="STRIPE_REVERSAL_ID"
        )

        canceled_payout = await payout_service.cancel(session, payout)

        assert canceled_payout.status == PayoutStatus.canceled
        assert payout_reversal_transaction.transfer_reversal_id == "STRIPE_REVERSAL_ID"


@pytest.mark.asyncio
class TestTriggerInvoiceGeneration:
    async def test_invoice_already_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture, account=account, payout_account=payout_account
        )
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
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
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
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        payout = await create_payout(
            save_fixture, account=account, payout_account=payout_account
        )
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
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        # Create first payout with a specific invoice number
        invoice_number = "INVOICE-123"
        payout1 = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            invoice_number=invoice_number,
        )
        await save_fixture(payout1)

        # Create second payout
        payout2 = await create_payout(
            save_fixture, account=account, payout_account=payout_account
        )
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
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        payout = await create_payout(
            save_fixture, account=account, payout_account=payout_account
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
            user,
            billing_name="Test Billing Name",
            billing_address=Address(country=CountryAlpha2("US"), line1="123 Test St"),
        )
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        original_invoice_number = "POLAR-12345"
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            invoice_number=original_invoice_number,
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
class TestReleaseHeldPayouts:
    async def test_valid(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        held_1 = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        held_2 = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        pending = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )

        await payout_service.release_held_payouts(session, account.id)

        repository = PayoutRepository.from_session(session)
        for payout in (held_1, held_2):
            refreshed = await repository.get_by_id(payout.id)
            assert refreshed is not None
            assert refreshed.status == PayoutStatus.pending

        # Both held payouts get their Stripe transfer enqueued; the
        # already-pending payout is left untouched.
        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call("payout.transfer", payout_id=held_1.id)
        enqueue_job_mock.assert_any_call("payout.transfer", payout_id=held_2.id)
        for call in enqueue_job_mock.call_args_list:
            assert call.kwargs["payout_id"] != pending.id

    async def test_no_held_payouts(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )

        await payout_service.release_held_payouts(session, account.id)

        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestCancelAccountPayouts:
    async def test_cancels_held_and_pending(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        held = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        pending = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )
        succeeded = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.succeeded,
        )

        # Attach a payout transaction (no transfer ran) to each cancelable
        # payout so PayoutService.cancel can reverse it.
        for payout in (held, pending):
            payout_transaction = Transaction(
                type=TransactionType.payout,
                account=account,
                processor=Processor.stripe,
                currency=payout.currency,
                amount=-payout.amount,
                account_currency=payout.account_currency,
                account_amount=-payout.account_amount,
                tax_amount=0,
                payout=payout,
                transfer_id=None,
            )
            await save_fixture(payout_transaction)

        payout_transaction_service_mock.reverse.return_value = Transaction()

        await payout_service.cancel_account_payouts(session, account.id)

        repository = PayoutRepository.from_session(session)
        for payout in (held, pending):
            refreshed = await repository.get_by_id(payout.id)
            assert refreshed is not None
            assert refreshed.status == PayoutStatus.canceled

        # The succeeded payout is not in-flight and must be left alone.
        refreshed_succeeded = await repository.get_by_id(succeeded.id)
        assert refreshed_succeeded is not None
        assert refreshed_succeeded.status == PayoutStatus.succeeded

    async def test_tolerates_concurrently_canceled_payout(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        # If a payout is finalized by a concurrent cancel between the fetch and
        # our cancel() (which then raises PayoutNotCancelable), the bulk job
        # must skip it and keep going rather than failing the whole run.
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        held_1 = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        held_2 = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )

        attempted: list[uuid.UUID] = []

        async def fake_cancel(session: AsyncSession, payout: "Payout") -> "Payout":
            attempted.append(payout.id)
            if payout.id == held_1.id:
                raise PayoutNotCancelable(payout)
            return payout

        mocker.patch.object(payout_service, "cancel", side_effect=fake_cancel)

        # Must not raise even though held_1's cancel raised.
        await payout_service.cancel_account_payouts(session, account.id)

        assert set(attempted) == {held_1.id, held_2.id}

    async def test_scopes_to_payout_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # On a payout-account swap we cancel only holds pinned to the previous
        # account; a fresh hold already created against the new account (the
        # cooldown clears once the old hold is >24h old) must survive.
        account = await create_account(save_fixture, user)
        old_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        new_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        stale_hold = await create_payout(
            save_fixture,
            account=account,
            payout_account=old_payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        fresh_hold = await create_payout(
            save_fixture,
            account=account,
            payout_account=new_payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=stale_hold.currency,
            amount=-stale_hold.amount,
            account_currency=stale_hold.account_currency,
            account_amount=-stale_hold.account_amount,
            tax_amount=0,
            payout=stale_hold,
            transfer_id=None,
        )
        await save_fixture(payout_transaction)
        payout_transaction_service_mock.reverse.return_value = Transaction()

        await payout_service.cancel_account_payouts(
            session,
            account.id,
            statuses=(PayoutStatus.held,),
            payout_account_id=old_payout_account.id,
        )

        repository = PayoutRepository.from_session(session)
        refreshed_stale = await repository.get_by_id(stale_hold.id)
        assert refreshed_stale is not None
        assert refreshed_stale.status == PayoutStatus.canceled

        refreshed_fresh = await repository.get_by_id(fresh_hold.id)
        assert refreshed_fresh is not None
        assert refreshed_fresh.status == PayoutStatus.held


@pytest.mark.asyncio
class TestCancelHeldPayout:
    async def test_held_is_cancelable_and_reverses_fees(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        fee_reversal_mock = mocker.patch(
            "polar.payout.service.platform_fee_transaction_service"
            ".create_payout_fees_reversal_balances"
        )

        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=-payout.amount,
            account_currency=payout.account_currency,
            account_amount=-payout.account_amount,
            tax_amount=0,
            payout=payout,
            # A held payout never ran its Stripe transfer.
            transfer_id=None,
        )
        await save_fixture(payout_transaction)

        payout_transaction_service_mock.reverse.return_value = Transaction()

        canceled = await payout_service.cancel(session, payout)

        assert canceled.status == PayoutStatus.canceled
        # No Stripe transfer ran, so we don't reverse a transfer but we do
        # return the reserved fees.
        stripe_service_mock.reverse_transfer.assert_not_called()
        fee_reversal_mock.assert_called_once_with(session, payout=payout)

    async def test_second_cancel_raises_after_lock_recheck(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        # cancel() locks and re-reads the row, so a second cancel of an
        # already-canceled payout (the loser of a concurrent race) raises
        # instead of writing a duplicate set of reversals.
        mocker.patch(
            "polar.payout.service.platform_fee_transaction_service"
            ".create_payout_fees_reversal_balances"
        )
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        payout_transaction = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=-payout.amount,
            account_currency=payout.account_currency,
            account_amount=-payout.account_amount,
            tax_amount=0,
            payout=payout,
            transfer_id=None,
        )
        await save_fixture(payout_transaction)
        payout_transaction_service_mock.reverse.return_value = Transaction()

        await payout_service.cancel(session, payout)
        # Flush so the canceled status is visible to the next FOR UPDATE read,
        # modelling the first cancel's transaction having committed (in prod the
        # two cancels are separate transactions serialized by the row lock).
        await session.flush()

        with pytest.raises(PayoutNotCancelable):
            await payout_service.cancel(session, payout)


@pytest.mark.asyncio
class TestCountPendingByPayoutAccount:
    async def test_includes_held(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        for status in (
            PayoutStatus.held,
            PayoutStatus.pending,
            PayoutStatus.in_transit,
            PayoutStatus.succeeded,
            PayoutStatus.canceled,
        ):
            await create_payout(
                save_fixture,
                account=account,
                payout_account=payout_account,
                status=status,
                attempts=[],
            )

        repository = PayoutRepository.from_session(session)
        count = await repository.count_pending_by_payout_account(payout_account.id)

        # held + pending + in_transit reserve funds; succeeded/canceled do not.
        assert count == 3
