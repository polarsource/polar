import pytest

from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.customer_meter.repository import CustomerMeterRepository
from polar.models import Customer, Organization, Subscription
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_meter


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
