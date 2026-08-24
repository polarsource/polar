from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import freezegun
import pytest
from pytest_mock import MockerFixture

from polar.billing_entry.repository import BillingEntryRepository
from polar.enums import SubscriptionProrationBehavior
from polar.event.system import SystemEvent
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Organization, Product
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.product_price import ProductPriceUnit
from polar.postgres import AsyncSession
from polar.product.tiers import Tiers, TierType
from polar.subscription.repository import SubscriptionUpdateRepository
from polar.subscription.service import (
    AboveMaximumUnits,
    BelowMinimumUnits,
    NotAUnitBasedSubscription,
    SubscriptionUpdateContext,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.events import get_all_by_name
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
    create_product_unit_based,
    create_subscription_with_units,
)


@pytest.fixture
def enqueue_benefits_grants_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(subscription_service, "enqueue_benefits_grants")


@pytest.fixture
def create_order_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock()
    mocker.patch.object(
        subscription_service, "_create_subscription_update_order", new=mock
    )
    return mock


@pytest.mark.asyncio
class TestUpdateUnits:
    async def test_prorated_increase(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        create_order_mock: AsyncMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=2900
        )
        unit_price = product.prices[0]
        assert isinstance(unit_price, ProductPriceUnit)

        with freezegun.freeze_time(datetime(2024, 1, 1, tzinfo=UTC)) as frozen_time:
            subscription = await create_subscription_with_units(
                save_fixture, product=product, customer=customer, units=3
            )
            assert subscription.amount == 3 * 2900

            # Exactly mid-period: 50% of the delta is billed.
            frozen_time.move_to(datetime(2024, 1, 16, 12, tzinfo=UTC))

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_units(
                    session,
                    ctx,
                    subscription,
                    units=5,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

        assert updated.units == 5
        assert updated.amount == 5 * 2900

        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(entries) == 1
        entry = entries[0]
        assert entry.type == BillingEntryType.subscription_units_increase
        assert entry.direction == BillingEntryDirection.debit
        assert entry.amount == (2 * 2900) // 2
        assert entry.product_price_id == unit_price.id

        events = await get_all_by_name(session, SystemEvent.subscription_units_updated)
        assert len(events) == 1
        assert events[0].user_metadata["old_units"] == 3
        assert events[0].user_metadata["new_units"] == 5

    async def test_prorated_decrease_credits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        create_order_mock: AsyncMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=2900
        )

        with freezegun.freeze_time(datetime(2024, 1, 1, tzinfo=UTC)) as frozen_time:
            subscription = await create_subscription_with_units(
                save_fixture, product=product, customer=customer, units=5
            )

            frozen_time.move_to(datetime(2024, 1, 16, 12, tzinfo=UTC))

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_units(
                    session,
                    ctx,
                    subscription,
                    units=2,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

        assert updated.units == 2
        assert updated.amount == 2 * 2900

        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(entries) == 1
        assert entries[0].type == BillingEntryType.subscription_units_decrease
        assert entries[0].direction == BillingEntryDirection.credit
        assert entries[0].amount == (3 * 2900) // 2

    async def test_next_period_schedules_pending_update(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=2900
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=product, customer=customer, units=3
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            updated = await subscription_service.update_units(
                session,
                ctx,
                subscription,
                units=10,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )
        await session.flush()

        assert updated.units == 3
        assert updated.pending_update is not None
        assert updated.pending_update.units == 10

    async def test_immediate_units_preserves_pending_product_change(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        with freezegun.freeze_time(datetime(2025, 1, 1, tzinfo=UTC)) as frozen_time:
            product_a = await create_product_unit_based(
                save_fixture, organization=organization, price_per_unit=1000
            )
            product_b = await create_product_unit_based(
                save_fixture, organization=organization, price_per_unit=2000
            )
            subscription = await create_subscription_with_units(
                save_fixture, product=product_a, customer=customer, units=3
            )
            previous_period_end = subscription.current_period_end
            assert previous_period_end is not None

            frozen_time.move_to(datetime(2025, 1, 16, 12, tzinfo=UTC))

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=product_b.id,
                    proration_behavior=SubscriptionProrationBehavior.next_period,
                )

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_units(
                    session,
                    ctx,
                    subscription,
                    units=10,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

            assert updated.product == product_a
            assert updated.units == 10

            sub_update_repo = SubscriptionUpdateRepository.from_session(session)
            pending = await sub_update_repo.get_unapplied_by_subscription_id(
                subscription.id
            )
            assert pending is not None
            assert pending.product_id == product_b.id
            assert pending.units is None

            frozen_time.move_to(previous_period_end + timedelta(seconds=1))
            async with SubscriptionUpdateContext(
                session, updated, subscription_service
            ) as ctx:
                cycled = await subscription_service.cycle(session, ctx, updated)
            await session.flush()

            assert cycled.product == product_b
            assert cycled.units == 10
            assert cycled.pending_update is None

    async def test_rejects_units_outside_pending_product_bounds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product_a = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=1000
        )
        product_b = await create_product_unit_based(
            save_fixture,
            organization=organization,
            price_per_unit=2000,
            minimum_units=10,
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=product_a, customer=customer, units=12
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=product_b.id,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )

        with pytest.raises(BelowMinimumUnits) as exc_info:
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_units(
                    session,
                    ctx,
                    subscription,
                    units=5,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )

        assert exc_info.value.minimum_units == 10
        assert exc_info.value.requested_units == 5
        assert exc_info.value.errors()[0]["loc"] == ("body", "units")

    async def test_same_units_is_noop(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=2900
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=product, customer=customer, units=3
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            updated = await subscription_service.update_units(
                session,
                ctx,
                subscription,
                units=3,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        assert updated.units == 3
        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert entries == []

    async def test_below_minimum_units(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture,
            organization=organization,
            minimum_units=5,
            tiers=Tiers.model_validate(
                {
                    "type": TierType.volume,
                    "tiers": [{"bound": 100, "unit_amount": "2900"}],
                }
            ),
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=product, customer=customer, units=5
        )

        with pytest.raises(BelowMinimumUnits):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_units(
                    session, ctx, subscription, units=4
                )

    async def test_above_maximum_units(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_unit_based(
            save_fixture,
            organization=organization,
            tiers=Tiers.model_validate(
                {
                    "type": TierType.volume,
                    "tiers": [{"bound": 100, "unit_amount": "2900"}],
                }
            ),
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=product, customer=customer, units=5
        )

        with pytest.raises(AboveMaximumUnits):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_units(
                    session, ctx, subscription, units=101
                )

    async def test_not_a_unit_based_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(NotAUnitBasedSubscription):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_units(
                    session, ctx, subscription, units=3
                )


@pytest.mark.asyncio
class TestUnitProductChange:
    async def test_switch_away_from_unit_product_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        unit_product = await create_product_unit_based(
            save_fixture, organization=organization
        )
        other_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=unit_product.recurring_interval,
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=unit_product, customer=customer, units=3
        )

        with pytest.raises(PolarRequestValidationError):
            await subscription_service.validate_product_change(
                session, subscription, product_id=other_product.id
            )

    async def test_switch_to_unit_product_promotes_minimum(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )
        unit_product = await create_product_unit_based(
            save_fixture, organization=organization, minimum_units=5
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            updated = await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=unit_product.id,
                proration_behavior=SubscriptionProrationBehavior.invoice,
            )

        assert updated.product == unit_product
        assert updated.units == 5

    async def test_unit_to_unit_product_change_keeps_count(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )
        old_unit_product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=1000
        )
        new_unit_product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=2000
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=old_unit_product, customer=customer, units=3
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            updated = await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=new_unit_product.id,
                proration_behavior=SubscriptionProrationBehavior.invoice,
            )

        assert updated.product == new_unit_product
        assert updated.units == 3

    async def test_unit_to_unit_rejects_below_target_minimum(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        old_unit_product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=1000
        )
        new_unit_product = await create_product_unit_based(
            save_fixture,
            organization=organization,
            price_per_unit=2000,
            minimum_units=5,
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=old_unit_product, customer=customer, units=3
        )

        with pytest.raises(BelowMinimumUnits) as exc_info:
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_unit_product.id,
                    proration_behavior=SubscriptionProrationBehavior.invoice,
                )

        assert exc_info.value.minimum_units == 5
        assert exc_info.value.requested_units == 3
        assert exc_info.value.errors()[0]["loc"] == ("body", "product_id")

    async def test_non_unit_to_unit_upgrade_rejects_next_period(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        unit_product = await create_product_unit_based(
            save_fixture, organization=organization
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=unit_product.id,
                    proration_behavior=SubscriptionProrationBehavior.next_period,
                )

        errors = exc_info.value.errors()
        assert any(
            error["loc"] == ("body", "proration_behavior")
            and "next_period" in error["msg"]
            for error in errors
        )
