from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.cutover import CutoverOutcome, SubscriptionCutover
from polar.models import (
    Customer,
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    PaymentMethod,
    Product,
    Subscription,
)
from polar.models.merchant_migration_record import MerchantMigrationCutoverStatus
from polar.models.organization import OrganizationStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_payment_method,
    create_subscription,
)
from tests.fixtures.stripe import build_stripe_payment_method
from tests.merchant_migration._helpers import (
    build_connected_migration,
    canonical_subscription,
    copied_cards,
    pan_steps_until,
    stage_subscription_record,
)

RunCutover = Callable[["_FakeSourceAdapter"], Awaitable[CutoverOutcome]]

STOPPED_BY_US = {
    "status": CanonicalSubscriptionStatus.canceled,
    "stopped_for_migration": True,
}


class _FakeSourceAdapter:
    """The merchant's Stripe account: what it reports, and what got stopped."""

    def __init__(
        self,
        subscription: CanonicalSubscription | None,
        *,
        error: Exception | None = None,
    ) -> None:
        self._subscription = subscription
        self._error = error
        self.stopped: list[str] = []

    async def get_subscription(self, source_id: str) -> CanonicalSubscription | None:
        if self._error is not None:
            raise self._error
        return self._subscription

    async def stop_source_subscription(self, source_id: str, *, reference: str) -> None:
        self.stopped.append(source_id)

    # Unused by the cutover, but a fake that satisfies half a protocol isn't one.
    async def extract(self) -> AsyncIterator[CanonicalRecord]:
        return
        yield

    async def get_source_account(self) -> CanonicalAccount:
        return CanonicalAccount(country="US", has_connected_accounts=False)


def _source(**fields: Any) -> _FakeSourceAdapter:
    return _FakeSourceAdapter(canonical_subscription(**fields))


def _assert_left_alone(adapter: _FakeSourceAdapter, subscription: Subscription) -> None:
    assert adapter.stopped == []
    assert subscription.status == SubscriptionStatus.paused


@pytest_asyncio.fixture
async def migration(
    save_fixture: SaveFixture, organization: Organization
) -> MerchantMigration:
    return await build_connected_migration(save_fixture, organization)


@pytest_asyncio.fixture
async def imported_customer(
    save_fixture: SaveFixture, organization: Organization
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization,
        email="imported@example.com",
        stripe_customer_id="cus_1",
    )


@pytest_asyncio.fixture
async def paused_subscription(
    save_fixture: SaveFixture, product: Product, imported_customer: Customer
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        customer=imported_customer,
        status=SubscriptionStatus.paused,
        current_period_start=utc_now() - timedelta(days=40),
        current_period_end=utc_now() - timedelta(days=10),
        user_metadata={"stripe_subscription_id": "sub_1"},
    )


@pytest_asyncio.fixture
async def record(
    save_fixture: SaveFixture,
    migration: MerchantMigration,
    organization: Organization,
    paused_subscription: Subscription,
) -> MerchantMigrationRecord:
    return await stage_subscription_record(
        save_fixture, migration, organization, paused_subscription
    )


@pytest_asyncio.fixture
async def copied_card(
    save_fixture: SaveFixture,
    imported_customer: Customer,
    paused_subscription: Subscription,
) -> PaymentMethod:
    """A copied card already attached to the subscription."""
    payment_method = await create_payment_method(
        save_fixture, imported_customer, processor_id="pm_copied"
    )
    paused_subscription.payment_method = payment_method
    await save_fixture(paused_subscription)
    return payment_method


@pytest.fixture
def cutover(
    session: AsyncSession,
    migration: MerchantMigration,
    record: MerchantMigrationRecord,
) -> RunCutover:
    async def run(adapter: _FakeSourceAdapter) -> CutoverOutcome:
        return await SubscriptionCutover(session, migration, adapter).run(record)

    return run


@pytest.mark.asyncio
class TestRun:
    async def test_moves_and_stops_the_source(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        renewal = utc_now() + timedelta(days=20)
        adapter = _source(current_period_end=renewal)

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == ["sub_1"]
        assert paused_subscription.status == SubscriptionStatus.active
        assert paused_subscription.paused_at is None
        # The first Polar charge lands on the date the customer already expects.
        assert paused_subscription.current_period_end == renewal
        assert paused_subscription.payment_method_id == copied_card.id

    async def test_charges_a_card_that_landed_after_the_card_check(
        self,
        mocker: MockerFixture,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        copied_cards(mocker, build_stripe_payment_method(customer="cus_1"))

        outcome = await cutover(_source())

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.payment_method_id is not None

    async def test_does_not_guess_when_a_mapping_was_uploaded(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, "verify_cards"
        )
        await save_fixture(migration)
        copied_cards(mocker, build_stripe_payment_method(customer="cus_1"))
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        _assert_left_alone(adapter, paused_subscription)

    async def test_reuses_the_exact_mapped_method_already_in_polar(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        cutover: RunCutover,
        copied_card: PaymentMethod,
    ) -> None:
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, "verify_cards"
        )
        await save_fixture(migration)
        get_payment_method = mocker.patch(
            "polar.merchant_migration.cards.stripe_service.get_payment_method",
            new=mocker.AsyncMock(
                side_effect=stripe_lib.InvalidRequestError("unavailable", "id")
            ),
        )

        outcome = await cutover(
            _source(
                payment_method=CanonicalPaymentMethod(
                    source_id="pm_source",
                    type=CanonicalPaymentMethodType.card,
                )
            )
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        get_payment_method.assert_not_awaited()

    async def test_keeps_a_running_trial_running(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        trial_end = utc_now() + timedelta(days=10)

        outcome = await cutover(
            _source(
                status=CanonicalSubscriptionStatus.trialing,
                current_period_end=trial_end,
                trial_end=trial_end,
            )
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.status == SubscriptionStatus.trialing
        assert paused_subscription.trial_end == trial_end
        assert paused_subscription.current_period_end == trial_end

    async def test_bills_a_trial_at_its_end_not_the_period_end(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """The scheduler converts a trial at `current_period_end`, so a source
        reporting a later period end would convert it weeks late."""
        trial_end = utc_now() + timedelta(days=10)

        outcome = await cutover(
            _source(
                status=CanonicalSubscriptionStatus.trialing,
                current_period_end=utc_now() + timedelta(days=45),
                trial_end=trial_end,
            )
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.status == SubscriptionStatus.trialing
        assert paused_subscription.trial_end == trial_end
        assert paused_subscription.current_period_end == trial_end

    async def test_rebuilds_a_period_the_source_reports_backwards(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """An inverted period would feed the renewal maths."""
        known_length = (
            paused_subscription.current_period_end
            - paused_subscription.current_period_start
        )
        renewal = utc_now() + timedelta(days=20)

        outcome = await cutover(
            _source(
                current_period_start=renewal + timedelta(days=10),
                current_period_end=renewal,
            )
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.current_period_end == renewal
        assert paused_subscription.current_period_start == renewal - known_length

    async def test_finishes_a_move_that_already_stopped_the_source(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """A crash between the cancellation and the commit must not read our own
        cancellation as the customer having churned."""
        # Lapsed by a day: Polar takes over and bills on the next scheduler pass.
        adapter = _source(**STOPPED_BY_US, current_period_end=utc_now() - timedelta(1))

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []
        assert paused_subscription.status == SubscriptionStatus.active

    async def test_keeps_a_trial_the_source_no_longer_reports_as_running(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """The source says `canceled` because we cancelled it, not the customer."""
        trial_end = utc_now() + timedelta(days=10)

        outcome = await cutover(
            _source(**STOPPED_BY_US, current_period_end=trial_end, trial_end=trial_end)
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.status == SubscriptionStatus.trialing
        assert paused_subscription.trial_end == trial_end

    async def test_takes_the_renewal_day_from_the_source_anchor(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """A 31st anchor reports a clamped Feb 28 period start."""
        outcome = await cutover(
            _source(
                current_period_start=datetime(2027, 2, 28, tzinfo=UTC),
                current_period_end=datetime(2027, 3, 31, tzinfo=UTC),
                anchor_day=31,
            )
        )

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.anchor_day == 31

    async def test_a_stopped_move_with_no_card_at_all_fails_loudly(
        self,
        mocker: MockerFixture,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        """Failed, not skipped: it needs chasing, and a retry can still finish."""
        copied_cards(mocker)

        outcome = await cutover(_source(**STOPPED_BY_US))

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert outcome.message is not None
        assert paused_subscription.status == SubscriptionStatus.paused

    async def test_moves_an_expired_card_and_says_so(
        self,
        save_fixture: SaveFixture,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """A card only proves itself on a real charge, so an expired one still
        moves and the merchant is told to chase it."""
        copied_card.method_metadata = {
            **copied_card.method_metadata,
            "exp_month": 6,
            "exp_year": 2020,
        }
        await save_fixture(copied_card)

        outcome = await cutover(_source())

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert "has expired" in (outcome.message or "")
        assert paused_subscription.status == SubscriptionStatus.active

    async def test_a_stopped_move_left_lapsed_for_months_fails(
        self,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        paused_subscription: Subscription,
    ) -> None:
        """The scheduler cycles once per period behind, so this would charge the
        customer for every period nobody billed."""
        outcome = await cutover(
            _source(**STOPPED_BY_US, current_period_end=utc_now() - timedelta(days=70))
        )

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert "every period missed since" in (outcome.message or "")
        assert paused_subscription.status == SubscriptionStatus.paused

    async def test_an_unreadable_staged_record_stops_at_that_record(
        self,
        save_fixture: SaveFixture,
        cutover: RunCutover,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        """One bad ledger row must not raise and stall the chain."""
        record.canonical = {}
        await save_fixture(record)
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        _assert_left_alone(adapter, paused_subscription)


@pytest.mark.asyncio
class TestAlreadyLiveOnPolar:
    """Reconciling: whatever activated it, the source must not still be billing."""

    @pytest_asyncio.fixture(autouse=True)
    async def live(
        self, save_fixture: SaveFixture, paused_subscription: Subscription
    ) -> None:
        paused_subscription.status = SubscriptionStatus.active
        await save_fixture(paused_subscription)

    async def test_a_second_run_stops_nothing_twice(self, cutover: RunCutover) -> None:
        adapter = _source(**STOPPED_BY_US)

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []

    async def test_resumed_by_hand_still_stops_the_source(
        self, cutover: RunCutover
    ) -> None:
        """Taking "active on Polar" as proof the source stopped bills them twice."""
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == ["sub_1"]

    async def test_source_already_gone_needs_no_reconciling(
        self, cutover: RunCutover
    ) -> None:
        adapter = _FakeSourceAdapter(None)

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []


@pytest.mark.asyncio
class TestSkips:
    """Every skip leaves the source billing and Polar paused."""

    @pytest.mark.parametrize(
        ("source_fields", "expected_reason"),
        [
            pytest.param(
                {"status": CanonicalSubscriptionStatus.canceled},
                "cancelled on the source",
                id="canceled-after-the-import",
            ),
            pytest.param(
                {"status": CanonicalSubscriptionStatus.past_due},
                None,
                id="payment-failing",
            ),
            pytest.param(
                {"cancel_at_period_end": True},
                "cancel at the end of the period",
                id="already-ending",
            ),
            pytest.param(
                {"current_period_end": utc_now() + timedelta(hours=6)},
                "too soon to hand over",
                id="renewal-inside-the-safety-window",
            ),
            pytest.param(
                {"current_period_end": utc_now() - timedelta(days=2)},
                "too soon to hand over",
                id="renewal-already-past",
            ),
            pytest.param(
                {"price_source_id": "price_upgraded"},
                "plan changed on the source",
                id="plan-changed",
            ),
            pytest.param({"line_item_count": 2}, None, id="second-line-item"),
            pytest.param(
                {"collection_method": CanonicalCollectionMethod.send_invoice},
                None,
                id="manual-invoicing",
            ),
        ],
    )
    async def test_source_is_no_longer_handable(
        self,
        cutover: RunCutover,
        paused_subscription: Subscription,
        source_fields: dict[str, Any],
        expected_reason: str | None,
    ) -> None:
        adapter = _source(**source_fields)

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        if expected_reason is not None:
            assert expected_reason in (outcome.message or "")
        _assert_left_alone(adapter, paused_subscription)

    async def test_source_subscription_gone(
        self, cutover: RunCutover, paused_subscription: Subscription
    ) -> None:
        adapter = _FakeSourceAdapter(None)

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "no longer exists on the source" in (outcome.message or "")
        _assert_left_alone(adapter, paused_subscription)

    async def test_organization_cannot_renew_subscriptions(
        self,
        save_fixture: SaveFixture,
        cutover: RunCutover,
        copied_card: PaymentMethod,
        organization: Organization,
        paused_subscription: Subscription,
    ) -> None:
        """The renewal scheduler skips these organizations, so it would never bill."""
        organization.status = OrganizationStatus.CREATED
        organization.capabilities = {
            **organization.capabilities,
            "subscription_renewals": False,
        }
        await save_fixture(organization)
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "can't renew subscriptions" in (outcome.message or "")
        _assert_left_alone(adapter, paused_subscription)

    async def test_no_card_landed_on_polar(
        self,
        mocker: MockerFixture,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        copied_cards(mocker)
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "No copied card" in (outcome.message or "")
        _assert_left_alone(adapter, paused_subscription)

    async def test_polar_subscription_canceled_by_the_merchant(
        self,
        save_fixture: SaveFixture,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        paused_subscription.status = SubscriptionStatus.canceled
        await save_fixture(paused_subscription)
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert adapter.stopped == []

    async def test_customer_deleted_on_polar(
        self,
        save_fixture: SaveFixture,
        cutover: RunCutover,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        imported_customer.deleted_at = utc_now()
        await save_fixture(imported_customer)
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        _assert_left_alone(adapter, paused_subscription)


@pytest.mark.asyncio
class TestFailures:
    async def test_stripe_error_is_retryable(
        self, cutover: RunCutover, paused_subscription: Subscription
    ) -> None:
        adapter = _FakeSourceAdapter(
            None, error=stripe_lib.APIConnectionError("Stripe is down")
        )

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert paused_subscription.status == SubscriptionStatus.paused

    async def test_two_indistinguishable_cards_are_retryable(
        self,
        mocker: MockerFixture,
        cutover: RunCutover,
        paused_subscription: Subscription,
    ) -> None:
        """Never resolved by guessing, and never at the cost of the whole run."""
        identical = {"last4": "4242", "brand": "visa", "exp_month": 4, "exp_year": 2030}
        copies = []
        for id in ("pm_copy_a", "pm_copy_b"):
            copy = build_stripe_payment_method(details=identical, customer="cus_1")
            copy.id = id
            copies.append(copy)
        copied_cards(mocker, *copies)
        adapter = _source(
            payment_method=CanonicalPaymentMethod(
                source_id="pm_on_the_source",
                type=CanonicalPaymentMethodType.card,
                **identical,  # type: ignore[arg-type]
            )
        )

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert "can't tell which is which" in (outcome.message or "")
        _assert_left_alone(adapter, paused_subscription)

    @pytest.mark.parametrize(
        ("target_id", "expected_reason"),
        [
            pytest.param(None, "never imported into Polar", id="never-imported"),
            pytest.param(uuid4(), "no longer exists", id="row-deleted"),
        ],
    )
    async def test_no_polar_subscription_to_switch_on(
        self,
        cutover: RunCutover,
        record: MerchantMigrationRecord,
        target_id: Any,
        expected_reason: str,
    ) -> None:
        record.target_id = target_id
        adapter = _source()

        outcome = await cutover(adapter)

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert expected_reason in (outcome.message or "")
        assert adapter.stopped == []
