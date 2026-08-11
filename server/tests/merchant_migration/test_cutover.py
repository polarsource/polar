from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Any

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import PaymentProcessor
from polar.kit.utils import utc_now
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.cutover import SubscriptionCutover
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
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_subscription
from tests.merchant_migration._helpers import (
    build_connected_migration,
    canonical_subscription,
    stage_subscription_record,
)


async def _no_payment_methods() -> AsyncIterator[Any]:
    """Nothing has landed on Polar's Stripe account for this customer yet."""
    return
    yield


class _FakeSourceAdapter:
    """Stands in for the merchant's Stripe account: what it reports back, and
    whether anyone actually stopped a subscription on it."""

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


def _succeeded_setup_intent(mocker: MockerFixture, status: str = "succeeded") -> Any:
    return mocker.patch(
        "polar.merchant_migration.cutover.stripe_service.create_setup_intent",
        new=mocker.AsyncMock(return_value=mocker.MagicMock(status=status)),
    )


async def _linked_card(save_fixture: SaveFixture, customer: Customer) -> PaymentMethod:
    payment_method = PaymentMethod(
        processor=PaymentProcessor.stripe,
        processor_id="pm_copied",
        type="card",
        method_metadata={},
        customer=customer,
    )
    await save_fixture(payment_method)
    return payment_method


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


@pytest.mark.asyncio
class TestRun:
    async def test_moves_and_stops_the_source(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        payment_method = await _linked_card(save_fixture, imported_customer)
        paused_subscription.payment_method = payment_method
        await save_fixture(paused_subscription)
        renewal = utc_now() + timedelta(days=20)
        adapter = _FakeSourceAdapter(canonical_subscription(current_period_end=renewal))
        _succeeded_setup_intent(mocker)

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == ["sub_1"]
        assert paused_subscription.status == SubscriptionStatus.active
        assert paused_subscription.paused_at is None
        # Polar picks the cycle up where the source left it, so the customer's
        # first Polar charge lands on the date they already expect.
        assert paused_subscription.current_period_end == renewal
        assert paused_subscription.payment_method_id == payment_method.id

    async def test_keeps_a_running_trial_running(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        payment_method = await _linked_card(save_fixture, imported_customer)
        paused_subscription.payment_method = payment_method
        await save_fixture(paused_subscription)
        trial_end = utc_now() + timedelta(days=10)
        adapter = _FakeSourceAdapter(
            canonical_subscription(
                status=CanonicalSubscriptionStatus.trialing,
                current_period_end=trial_end,
                trial_end=trial_end,
            )
        )
        _succeeded_setup_intent(mocker)

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert paused_subscription.status == SubscriptionStatus.trialing
        assert paused_subscription.trial_end == trial_end
        assert paused_subscription.current_period_end == trial_end

    async def test_finishes_a_move_that_already_stopped_the_source(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        """A crash between the Stripe cancellation and the commit must not read
        our own cancellation as the customer having churned."""
        payment_method = await _linked_card(save_fixture, imported_customer)
        paused_subscription.payment_method = payment_method
        await save_fixture(paused_subscription)
        adapter = _FakeSourceAdapter(
            canonical_subscription(
                status=CanonicalSubscriptionStatus.canceled,
                # Cancelled, and its period has since lapsed: Polar takes over
                # anyway, and bills on the next scheduler pass.
                current_period_end=utc_now() - timedelta(days=1),
                stopped_for_migration=True,
            )
        )
        _succeeded_setup_intent(mocker)

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []
        assert paused_subscription.status == SubscriptionStatus.active

    async def test_a_second_run_stops_nothing_twice(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        paused_subscription.status = SubscriptionStatus.active
        await save_fixture(paused_subscription)
        adapter = _FakeSourceAdapter(
            canonical_subscription(
                status=CanonicalSubscriptionStatus.canceled,
                stopped_for_migration=True,
            )
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []

    async def test_resumed_by_hand_still_stops_the_source(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        """A customer can resume a paused subscription from their portal. Taking
        "active on Polar" as proof the source stopped would bill them twice."""
        paused_subscription.status = SubscriptionStatus.active
        await save_fixture(paused_subscription)
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == ["sub_1"]

    async def test_source_already_gone_needs_no_reconciling(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        paused_subscription.status = SubscriptionStatus.active
        await save_fixture(paused_subscription)
        adapter = _FakeSourceAdapter(None)

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == []


@pytest.mark.asyncio
class TestSkips:
    """Every skip must leave the source billing: nothing is cancelled, and the
    Polar subscription stays paused."""

    def _assert_left_alone(
        self,
        adapter: _FakeSourceAdapter,
        subscription: Subscription,
    ) -> None:
        assert adapter.stopped == []
        assert subscription.status == SubscriptionStatus.paused

    async def test_source_subscription_gone(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(None)

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "no longer exists on the source" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_source_canceled_after_the_import(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(status=CanonicalSubscriptionStatus.canceled)
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "cancelled on the source" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_source_payment_failing(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(status=CanonicalSubscriptionStatus.past_due)
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        self._assert_left_alone(adapter, paused_subscription)

    async def test_source_already_ending(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(canonical_subscription(cancel_at_period_end=True))

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "cancel at the end of the period" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_renewal_inside_the_safety_window(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(current_period_end=utc_now() + timedelta(hours=6))
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "too soon to hand over" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_renewal_already_past(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(current_period_end=utc_now() - timedelta(days=2))
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        self._assert_left_alone(adapter, paused_subscription)

    async def test_plan_changed_on_the_source(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(price_source_id="price_upgraded")
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "plan changed on the source" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_source_grew_a_second_line_item(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(canonical_subscription(line_item_count=2))

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        self._assert_left_alone(adapter, paused_subscription)

    async def test_source_switched_to_manual_invoicing(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            canonical_subscription(
                collection_method=CanonicalCollectionMethod.send_invoice
            )
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        self._assert_left_alone(adapter, paused_subscription)

    async def test_no_card_landed_on_polar(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        mocker.patch(
            "polar.merchant_migration.cards.stripe_service.list_payment_methods",
            return_value=_no_payment_methods(),
        )
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "No copied card" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_card_declined_when_validated(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        payment_method = await _linked_card(save_fixture, imported_customer)
        paused_subscription.payment_method = payment_method
        await save_fixture(paused_subscription)
        mocker.patch(
            "polar.merchant_migration.cutover.stripe_service.create_setup_intent",
            new=mocker.AsyncMock(
                side_effect=stripe_lib.CardError("Your card was declined.", None, None)
            ),
        )
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "declined by the bank" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_card_needs_authentication(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        payment_method = await _linked_card(save_fixture, imported_customer)
        paused_subscription.payment_method = payment_method
        await save_fixture(paused_subscription)
        _succeeded_setup_intent(mocker, status="requires_action")
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert "without the customer confirming" in (outcome.reason or "")
        self._assert_left_alone(adapter, paused_subscription)

    async def test_polar_subscription_canceled_by_the_merchant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        paused_subscription.status = SubscriptionStatus.canceled
        await save_fixture(paused_subscription)
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        assert adapter.stopped == []

    async def test_customer_deleted_on_polar(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        imported_customer: Customer,
        paused_subscription: Subscription,
    ) -> None:
        imported_customer.deleted_at = utc_now()
        await save_fixture(imported_customer)
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.skipped
        self._assert_left_alone(adapter, paused_subscription)


@pytest.mark.asyncio
class TestFailures:
    async def test_stripe_error_is_retryable(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
        paused_subscription: Subscription,
    ) -> None:
        adapter = _FakeSourceAdapter(
            None, error=stripe_lib.APIConnectionError("Stripe is down")
        )

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert paused_subscription.status == SubscriptionStatus.paused

    async def test_missing_polar_subscription(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        record: MerchantMigrationRecord,
    ) -> None:
        record.target_id = None
        adapter = _FakeSourceAdapter(canonical_subscription())

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.failed
        assert adapter.stopped == []
