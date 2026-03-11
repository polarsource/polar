import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member, MemberRole
from scripts.migrate_organizations_members import get_repair_candidates
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_customer_seat,
    create_organization,
    create_product,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestGetRepairCandidates:
    async def test_only_missing_filters_to_incomplete_non_seat_orgs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        affected_org = await create_organization(
            save_fixture,
            name_prefix="affected",
            feature_settings={"member_model_enabled": True},
            next_review_threshold=100,
        )
        affected_customer = await create_customer(
            save_fixture,
            organization=affected_org,
            email="affected@example.com",
        )
        benefit = await create_benefit(save_fixture, organization=affected_org)
        await create_benefit_grant(
            save_fixture,
            customer=affected_customer,
            benefit=benefit,
            granted=True,
        )

        healthy_org = await create_organization(
            save_fixture,
            name_prefix="healthy",
            feature_settings={"member_model_enabled": True},
            next_review_threshold=200,
        )
        healthy_customer = await create_customer(
            save_fixture,
            organization=healthy_org,
            email="healthy@example.com",
        )
        await save_fixture(
            Member(
                customer_id=healthy_customer.id,
                organization_id=healthy_org.id,
                email=healthy_customer.email,
                role=MemberRole.owner,
            )
        )

        seat_org = await create_organization(
            save_fixture,
            name_prefix="seat",
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
            next_review_threshold=300,
        )
        await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat@example.com",
        )

        candidates, total_count = await get_repair_candidates(
            session, only_missing=True
        )

        assert total_count == 1
        assert len(candidates) == 1
        candidate = candidates[0]
        assert candidate.organization.id == affected_org.id
        assert candidate.missing_owner_members == 1
        assert candidate.seats_missing_member == 0
        assert candidate.grants_missing_member == 1

    async def test_only_missing_detects_missing_seat_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        organization = await create_organization(
            save_fixture,
            name_prefix="seatgap",
            feature_settings={"member_model_enabled": True},
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@example.com",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=billing_customer,
            claimed_at=utc_now(),
        )

        candidates, total_count = await get_repair_candidates(
            session,
            slug=organization.slug,
            only_missing=True,
        )

        assert total_count == 1
        assert len(candidates) == 1
        candidate = candidates[0]
        assert candidate.organization.id == organization.id
        assert candidate.missing_owner_members == 1
        assert candidate.seats_missing_member == 1
        assert candidate.grants_missing_member == 0
