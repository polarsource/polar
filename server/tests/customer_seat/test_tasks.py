import uuid

import pytest
from pytest_mock import MockerFixture

from polar.customer_seat.tasks import revoke_seats_for_member
from polar.models import Organization
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member, MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_customer_seat,
    create_product,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestRevokeSeatForMember:
    async def test_no_active_seats(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that task handles members with no active seats gracefully."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Should not raise any errors
        await revoke_seats_for_member(member.id)

    async def test_revokes_active_seats(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that task revokes all active seats for a member."""
        from polar.enums import SubscriptionRecurringInterval
        from polar.kit.utils import utc_now
        from polar.models.subscription import SubscriptionStatus

        organization.feature_settings = {
            **organization.feature_settings,
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

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
            seats=5,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        member = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member To Revoke",
            role=MemberRole.member,
        )
        await save_fixture(member)

        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=billing_customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
            member_id=member.id,
            email=member.email,
        )
        seat_id = seat.id

        # Expunge so task creates its own session
        session.expunge_all()

        # Execute the task
        await revoke_seats_for_member(member.id)

        # Re-fetch the seat to verify it was revoked
        from polar.customer_seat.repository import CustomerSeatRepository

        repository = CustomerSeatRepository.from_session(session)
        updated_seat = await repository.get_by_id(seat_id)
        assert updated_seat is not None
        assert updated_seat.status == SeatStatus.revoked
        assert updated_seat.member_id is None
        assert updated_seat.revoked_at is not None

    async def test_nonexistent_member_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        """Test that task handles nonexistent member IDs gracefully."""
        # Should not raise any errors for nonexistent member
        await revoke_seats_for_member(uuid.uuid4())
