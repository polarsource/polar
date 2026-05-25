import pytest

from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.customer_meter.repository import CustomerMeterRepository
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Customer, Organization, Product, Subscription
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_event,
    create_meter,
    create_order,
)


@pytest.mark.asyncio
class TestCycleMeterCredit:
    async def test_cycle_considers_rollover_from_other_benefit(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        subscription: Subscription,
    ) -> None:
        """
        Test that cycling a non-rollover benefit still preserves rollover credits
        granted by another benefit (e.g., a one-time top-up with rollover enabled).
        """
        meter = await create_meter(save_fixture, organization=organization)

        subscription_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 100, "rollover": False},
        )

        topup_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 50, "rollover": True},
        )

        subscription_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, subscription_benefit, subscription=subscription
        )

        topup_order = await create_order(
            save_fixture, customer=customer, product=product
        )
        await benefit_grant_service.grant_benefit(
            session, redis, customer, topup_benefit, order=topup_order
        )

        await benefit_grant_service.cycle_benefit_grant(
            session, redis, subscription_grant
        )

        customer_meter_repo = CustomerMeterRepository.from_session(session)
        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )

        assert customer_meter is not None
        # After cycle: 50 rollover units from top-up + 100 new cycle units = 150
        assert customer_meter.balance == 150


@pytest.mark.asyncio
class TestMeterCreditBenefitIntegration:
    """
    Integration tests for meter credit benefits.

    These tests verify the end-to-end flow of granting meter credit benefits
    and ensuring CustomerMeter records are created correctly.
    """

    async def test_grant_creates_customer_meter(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        """
        Test that granting a meter credit benefit creates a CustomerMeter immediately.

        This verifies that active_meters will include the meter right after
        subscribing to a product with a meter credit benefit.
        """
        # Create a meter for the organization
        meter = await create_meter(save_fixture, organization=organization)

        # Create a meter credit benefit
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={
                "meter_id": str(meter.id),
                "units": 100,
                "rollover": False,
            },
        )

        # Grant the benefit to the customer
        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, subscription=subscription
        )

        # Verify the grant was created
        assert grant is not None
        assert grant.is_granted
        assert grant.customer_id == customer.id
        assert grant.benefit_id == benefit.id

        # Verify a CustomerMeter was created
        customer_meter_repo = CustomerMeterRepository.from_session(session)
        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )

        assert customer_meter is not None
        assert customer_meter.customer_id == customer.id
        assert customer_meter.meter_id == meter.id
        assert customer_meter.credited_units == 100
        assert customer_meter.consumed_units == 0
        assert customer_meter.balance == 100

    async def test_upgrade_balance_without_meter_reset(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        """
        Regression test for issue #11427.

        Revoke-then-grant on a product change must land at the new product's
        credit total without relying on a `meter_reset` event. Verifies that
        meter_credit.revoke() emits the matching negative-units event so the
        balance is symmetric across an upgrade.
        """
        meter = await create_meter(save_fixture, organization=organization)

        old_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 100, "rollover": False},
        )
        new_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 1000, "rollover": False},
        )

        customer_meter_repo = CustomerMeterRepository.from_session(session)

        await benefit_grant_service.grant_benefit(
            session, redis, customer, old_benefit, subscription=subscription
        )
        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.balance == 100

        await benefit_grant_service.revoke_benefit(
            session, redis, customer, old_benefit, subscription=subscription
        )
        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.balance == 0

        await benefit_grant_service.grant_benefit(
            session, redis, customer, new_benefit, subscription=subscription
        )
        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.balance == 1000

    async def test_upgrade_usage_persists_mid_cycle(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        """
        Regression test for the design intent established by 6e1d2513e (#9037):
        on a mid-cycle subscription update, meter credits AND usage both persist.
        The customer's prior usage counts toward the new product's allowance;
        they don't get a fresh slate.

        Inverse check against commit 311ade8ec: that commit added a meter_reset
        into the benefit pipeline as a side effect of fixing an unrelated
        ordering race. If anything re-introduces a reset on the update path,
        the final balance becomes 1000 instead of 920 and this test fails.
        """
        meter = await create_meter(
            save_fixture,
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="usage"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )

        old_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 100, "rollover": False},
        )
        new_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 1000, "rollover": False},
        )

        customer_meter_repo = CustomerMeterRepository.from_session(session)

        # Customer subscribes to the old plan (100 credits)
        await benefit_grant_service.grant_benefit(
            session, redis, customer, old_benefit, subscription=subscription
        )

        # Customer uses 80 units on the old plan
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="usage",
            metadata={"tokens": 80},
        )
        await customer_meter_service.update_customer_meter(session, customer, meter)

        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.credited_units == 100
        assert customer_meter.consumed_units == 80
        assert customer_meter.balance == 20

        # Mid-cycle upgrade: revoke old, grant new (the pipeline ordering)
        await benefit_grant_service.revoke_benefit(
            session, redis, customer, old_benefit, subscription=subscription
        )
        await benefit_grant_service.grant_benefit(
            session, redis, customer, new_benefit, subscription=subscription
        )

        customer_meter = await customer_meter_repo.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        # credit events [+100, -100, +1000] running sum clamped at 0 → 1000
        assert customer_meter.credited_units == 1000
        # 80 units of pre-upgrade usage carry over against the new allowance
        assert customer_meter.consumed_units == 80
        assert customer_meter.balance == 920
