import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from polar.auth.models import AuthSubject
from polar.customer_seat.service import (
    CustomerNotFound,
    FeatureNotEnabled,
    InvalidInvitationToken,
    InvalidSeatAssignmentRequest,
    SeatAlreadyAssigned,
    SeatNotAvailable,
    SeatNotPending,
    seat_service,
)
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product, Subscription, User
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_customer_seat,
    create_organization,
    create_product,
    create_product_price_seat_unit,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestCheckSeatFeatureEnabled:
    async def test_feature_enabled(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        organization = await create_organization(save_fixture)
        organization.feature_settings = {"seat_based_pricing_enabled": True}
        await save_fixture(organization)
        await seat_service.check_seat_feature_enabled(session, organization.id)

    async def test_feature_disabled(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        organization = await create_organization(save_fixture)
        organization.feature_settings = {"seat_based_pricing_enabled": False}
        await save_fixture(organization)
        with pytest.raises(FeatureNotEnabled):
            await seat_service.check_seat_feature_enabled(session, organization.id)

    async def test_feature_missing(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        organization = await create_organization(save_fixture)
        organization.feature_settings = {}
        await save_fixture(organization)
        with pytest.raises(FeatureNotEnabled):
            await seat_service.check_seat_feature_enabled(session, organization.id)


class TestListSeats:
    @pytest.mark.asyncio
    async def test_list_seats_success(
        self,
        session: AsyncSession,
        seat_enabled_organization: Organization,
        subscription_with_seats: Subscription,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        seats = await seat_service.list_seats(session, subscription_with_seats)
        assert len(seats) == 1
        assert seats[0].id == customer_seat_pending.id

    @pytest.mark.asyncio
    async def test_list_seats_feature_disabled(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        subscription.product.organization.feature_settings = {}
        with pytest.raises(FeatureNotEnabled):
            await seat_service.list_seats(session, subscription)


class TestGetAvailableSeatsCount:
    @pytest.mark.asyncio
    async def test_available_seats_with_none_claimed(
        self, session: AsyncSession, subscription_with_seats: Subscription
    ) -> None:
        count = await seat_service.get_available_seats_count(
            session, subscription_with_seats
        )
        assert count == 5

    @pytest.mark.asyncio
    async def test_available_seats_with_claimed_seat(
        self,
        session: AsyncSession,
        subscription_with_seats: Subscription,
        customer_seat_claimed: CustomerSeat,
    ) -> None:
        count = await seat_service.get_available_seats_count(
            session, subscription_with_seats
        )
        assert count == 4

    @pytest.mark.asyncio
    async def test_available_seats_feature_disabled(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        subscription.product.organization.feature_settings = {}
        with pytest.raises(FeatureNotEnabled):
            await seat_service.get_available_seats_count(session, subscription)


class TestAssignSeat:
    @pytest.mark.asyncio
    async def test_assign_seat_with_email_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="test@example.com"
        )

        assert seat.subscription_id == subscription_with_seats.id
        assert seat.status == SeatStatus.pending
        assert seat.invitation_token is not None
        assert seat.customer_id == customer.id

    @pytest.mark.asyncio
    async def test_assign_seat_with_external_customer_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            external_id="ext123",
        )

        seat = await seat_service.assign_seat(
            session, subscription_with_seats, external_customer_id="ext123"
        )

        assert seat.subscription_id == subscription_with_seats.id
        assert seat.status == SeatStatus.pending
        assert seat.invitation_token is not None
        assert seat.customer_id == customer.id

    @pytest.mark.asyncio
    async def test_assign_seat_with_customer_id(
        self,
        session: AsyncSession,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        seat = await seat_service.assign_seat(
            session, subscription_with_seats, customer_id=customer.id
        )

        assert seat.subscription_id == subscription_with_seats.id
        assert seat.customer_id == customer.id
        assert seat.status == SeatStatus.pending

    @pytest.mark.asyncio
    async def test_assign_seat_no_identifiers(
        self, session: AsyncSession, subscription_with_seats: Subscription
    ) -> None:
        with pytest.raises(InvalidSeatAssignmentRequest):
            await seat_service.assign_seat(session, subscription_with_seats)

    @pytest.mark.asyncio
    async def test_assign_seat_multiple_identifiers(
        self,
        session: AsyncSession,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        with pytest.raises(InvalidSeatAssignmentRequest):
            await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                customer_id=customer.id,
            )

    @pytest.mark.asyncio
    async def test_assign_seat_no_available_seats(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        subscription_with_seats.seats = 0
        await save_fixture(subscription_with_seats)

        with pytest.raises(SeatNotAvailable):
            await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
            )

    @pytest.mark.asyncio
    async def test_assign_seat_customer_already_has_seat(
        self,
        session: AsyncSession,
        subscription_with_seats: Subscription,
        customer: Customer,
        customer_seat_claimed: CustomerSeat,
    ) -> None:
        with pytest.raises(SeatAlreadyAssigned) as exc_info:
            await seat_service.assign_seat(
                session, subscription_with_seats, customer_id=customer.id
            )
        assert str(customer.id) in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_assign_seat_with_metadata(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        metadata = {"role": "admin", "department": "engineering"}
        seat = await seat_service.assign_seat(
            session,
            subscription_with_seats,
            email="test@example.com",
            metadata=metadata,
        )

        assert seat.seat_metadata == metadata
        assert seat.customer_id == customer.id

    @pytest.mark.asyncio
    async def test_assign_seat_customer_not_found_email(
        self, session: AsyncSession, subscription_with_seats: Subscription
    ) -> None:
        """Test that assigning a seat with a new email creates a customer automatically."""
        seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="nonexistent@example.com"
        )

        assert seat.customer_id is not None
        # Customer is created automatically with the provided email

    @pytest.mark.asyncio
    async def test_assign_seat_customer_not_found_external_id(
        self, session: AsyncSession, subscription_with_seats: Subscription
    ) -> None:
        with pytest.raises(CustomerNotFound) as exc_info:
            await seat_service.assign_seat(
                session, subscription_with_seats, external_customer_id="nonexistent123"
            )
        assert "nonexistent123" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_assign_seat_customer_not_found_customer_id(
        self, session: AsyncSession, subscription_with_seats: Subscription
    ) -> None:
        fake_customer_id = uuid.uuid4()
        with pytest.raises(CustomerNotFound) as exc_info:
            await seat_service.assign_seat(
                session, subscription_with_seats, customer_id=fake_customer_id
            )
        assert str(fake_customer_id) in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_assign_seat_feature_disabled(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        subscription.product.organization.feature_settings = {}
        with pytest.raises(FeatureNotEnabled):
            await seat_service.assign_seat(
                session, subscription, email="test@example.com"
            )

    @pytest.mark.asyncio
    async def test_assign_seat_creates_new_customer_with_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that assigning a seat with an email creates a new customer if not found."""
        seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="newuser@example.com"
        )

        # Refresh the seat to load the customer relationship
        await session.refresh(seat, ["customer"])

        assert seat.customer_id is not None
        assert seat.customer is not None
        assert seat.customer.email == "newuser@example.com"
        assert (
            seat.customer.organization_id
            == subscription_with_seats.product.organization_id
        )

    @pytest.mark.asyncio
    async def test_assign_seat_token_expiration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="test@example.com"
        )

        assert seat.invitation_token_expires_at is not None
        # Token should expire in approximately 24 hours
        now = datetime.now(UTC)
        expected_expiration = now + timedelta(hours=24)
        time_diff = abs(
            (seat.invitation_token_expires_at - expected_expiration).total_seconds()
        )
        assert time_diff < 60  # Within 1 minute

    @pytest.mark.asyncio
    async def test_assign_seat_reuses_revoked_seat(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that assigning a seat to a customer with a revoked seat reuses the existing seat record."""
        # Create and revoke a seat for the customer
        revoked_seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(revoked_seat, ["subscription"])
        assert revoked_seat.subscription is not None
        await session.refresh(revoked_seat.subscription, ["product"])
        assert revoked_seat.subscription is not None
        await session.refresh(revoked_seat.subscription.product, ["organization"])

        revoked_seat = await seat_service.revoke_seat(session, revoked_seat)
        await session.flush()

        original_seat_id = revoked_seat.id
        assert revoked_seat.status == SeatStatus.revoked
        assert revoked_seat.revoked_at is not None
        assert revoked_seat.customer_id is None

        # Now assign a seat to the same customer again
        new_seat = await seat_service.assign_seat(
            session, subscription_with_seats, customer_id=customer.id
        )

        # Should reuse the same seat record
        assert new_seat.id == original_seat_id
        assert new_seat.status == SeatStatus.pending
        assert new_seat.customer_id == customer.id
        assert new_seat.invitation_token is not None
        assert new_seat.invitation_token_expires_at is not None
        assert new_seat.revoked_at is None
        assert new_seat.claimed_at is None

    @pytest.mark.asyncio
    async def test_assign_seat_sends_webhook(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        with patch("polar.webhook.service.webhook.send") as mock_send:
            mock_send.return_value = []
            seat = await seat_service.assign_seat(
                session, subscription_with_seats, email="test@example.com"
            )

            mock_send.assert_called_once()
            args = mock_send.call_args
            assert args[0][1].id == subscription_with_seats.product.organization.id
            assert args[0][2] == WebhookEventType.customer_seat_assigned
            assert args[0][3].id == seat.id

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_with_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        seat = await seat_service.assign_seat(
            session,
            subscription_with_seats,
            email="test@example.com",
            immediate_claim=True,
        )

        assert seat.subscription_id == subscription_with_seats.id
        assert seat.status == SeatStatus.claimed
        assert seat.invitation_token is None
        assert seat.invitation_token_expires_at is None
        assert seat.customer_id == customer.id
        assert seat.claimed_at is not None

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_no_invitation_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        with patch(
            "polar.customer_seat.service.send_seat_invitation_email"
        ) as mock_email:
            await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                immediate_claim=True,
            )
            # Email should NOT be sent for immediate claims
            mock_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_sends_claimed_webhook(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        with patch("polar.webhook.service.webhook.send") as mock_send:
            mock_send.return_value = []
            seat = await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                immediate_claim=True,
            )

            mock_send.assert_called_once()
            args = mock_send.call_args
            assert args[0][1].id == subscription_with_seats.product.organization.id
            assert args[0][2] == WebhookEventType.customer_seat_claimed
            assert args[0][3].id == seat.id

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_enqueues_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        with patch("polar.customer_seat.service.enqueue_job") as mock_enqueue:
            seat = await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                immediate_claim=True,
            )

            mock_enqueue.assert_called_once_with(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=customer.id,
                product_id=subscription_with_seats.product.id,
                member_id=seat.member_id,
                subscription_id=subscription_with_seats.id,
            )

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_revoked_seat_reuse(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        # Create and revoke a seat first
        original_customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="original@example.com",
        )
        original_seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="original@example.com"
        )
        original_seat_id = original_seat.id
        await session.flush()

        # Claim it first
        await seat_service.claim_seat(session, original_seat.invitation_token or "")
        await session.flush()

        # Revoke the seat
        await seat_service.revoke_seat(session, original_seat)
        await session.flush()

        # Now assign a new seat with immediate claim
        new_customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="new@example.com",
        )
        new_seat = await seat_service.assign_seat(
            session,
            subscription_with_seats,
            email="new@example.com",
            immediate_claim=True,
        )

        # Should reuse the same seat record
        assert new_seat.id == original_seat_id
        assert new_seat.status == SeatStatus.claimed
        assert new_seat.customer_id == new_customer.id
        assert new_seat.invitation_token is None
        assert new_seat.invitation_token_expires_at is None
        assert new_seat.revoked_at is None
        assert new_seat.claimed_at is not None

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_customer_already_has_seat(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        # First assignment with immediate claim
        await seat_service.assign_seat(
            session,
            subscription_with_seats,
            email="test@example.com",
            immediate_claim=True,
        )
        await session.flush()

        # Second assignment should fail
        with pytest.raises(SeatAlreadyAssigned):
            await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                immediate_claim=True,
            )

    @pytest.mark.asyncio
    async def test_assign_seat_immediate_claim_publishes_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        with patch("polar.customer_seat.service.eventstream_publish") as mock_publish:
            seat = await seat_service.assign_seat(
                session,
                subscription_with_seats,
                email="test@example.com",
                immediate_claim=True,
            )

            mock_publish.assert_called_once_with(
                "customer_seat.claimed",
                {
                    "seat_id": str(seat.id),
                    "subscription_id": str(subscription_with_seats.id),
                    "order_id": None,
                    "product_id": str(subscription_with_seats.product.id),
                },
                customer_id=customer.id,
            )

    @pytest.mark.asyncio
    async def test_assign_seat_with_member_model_enabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Test that assign_seat creates a member when member_model_enabled is true."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "seat_based_pricing_enabled": True,
                "member_model_enabled": True,
            },
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=1000
        )
        # Billing manager customer (subscription owner)
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@example.com",
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing_customer, seats=5
        )
        # Seat customer (to be assigned a seat)
        seat_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="seat@example.com",
        )

        seat = await seat_service.assign_seat(
            session, subscription, email="seat@example.com"
        )

        assert seat.customer_id == seat_customer.id
        assert seat.member_id is not None

        # Verify member was created with correct properties
        await session.refresh(seat, ["member"])
        assert seat.member is not None
        assert seat.member.customer_id == seat_customer.id
        assert seat.member.email == seat_customer.email
        assert seat.member.organization_id == organization.id

    @pytest.mark.asyncio
    async def test_assign_seat_without_member_model_enabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that assign_seat does not create a member when member_model is disabled."""
        customer = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        seat = await seat_service.assign_seat(
            session, subscription_with_seats, email="test@example.com"
        )

        assert seat.customer_id == customer.id
        assert seat.member_id is None


class TestGetSeatByToken:
    @pytest.mark.asyncio
    async def test_get_seat_by_token_success(
        self, session: AsyncSession, customer_seat_pending: CustomerSeat
    ) -> None:
        assert customer_seat_pending.invitation_token is not None
        seat = await seat_service.get_seat_by_token(
            session, customer_seat_pending.invitation_token
        )

        assert seat is not None
        assert seat.id == customer_seat_pending.id

    @pytest.mark.asyncio
    async def test_get_seat_by_token_invalid(self, session: AsyncSession) -> None:
        seat = await seat_service.get_seat_by_token(session, "invalid_token")
        assert seat is None

    @pytest.mark.asyncio
    async def test_get_seat_by_token_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        old_token = customer_seat_pending.invitation_token
        customer_seat_pending.status = SeatStatus.revoked
        await save_fixture(customer_seat_pending)

        assert old_token is not None
        seat = await seat_service.get_seat_by_token(session, old_token)
        assert seat is None

    @pytest.mark.asyncio
    async def test_get_seat_by_token_claimed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        old_token = customer_seat_pending.invitation_token
        customer_seat_pending.status = SeatStatus.claimed
        await save_fixture(customer_seat_pending)

        assert old_token is not None
        seat = await seat_service.get_seat_by_token(session, old_token)
        assert seat is None

    @pytest.mark.asyncio
    async def test_get_seat_by_token_expired(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        old_token = customer_seat_pending.invitation_token
        customer_seat_pending.invitation_token_expires_at = datetime.now(
            UTC
        ) - timedelta(hours=1)
        await save_fixture(customer_seat_pending)

        assert old_token is not None
        seat = await seat_service.get_seat_by_token(session, old_token)
        assert seat is None


class TestClaimSeat:
    @pytest.mark.asyncio
    async def test_claim_seat_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        seat_pending = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
        )
        await session.refresh(seat_pending, ["subscription"])
        assert seat_pending.subscription is not None
        await session.refresh(seat_pending.subscription, ["product"])
        assert seat_pending.subscription is not None
        await session.refresh(seat_pending.subscription.product, ["organization"])

        assert seat_pending.invitation_token is not None

        seat, session_token = await seat_service.claim_seat(
            session, seat_pending.invitation_token
        )

        assert seat.customer_id == customer.id
        assert seat.status == SeatStatus.claimed
        assert seat.claimed_at is not None
        assert isinstance(seat.claimed_at, datetime)
        assert session_token is not None
        assert len(session_token) > 0

    @pytest.mark.asyncio
    async def test_claim_seat_invalid_token(self, session: AsyncSession) -> None:
        with pytest.raises(InvalidInvitationToken):
            await seat_service.claim_seat(session, "invalid_token")

    @pytest.mark.asyncio
    async def test_claim_seat_revoked_seat(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        customer_seat_pending.status = SeatStatus.revoked
        await save_fixture(customer_seat_pending)

        assert customer_seat_pending.invitation_token is not None
        with pytest.raises(InvalidInvitationToken):
            await seat_service.claim_seat(
                session,
                customer_seat_pending.invitation_token,
            )

    @pytest.mark.asyncio
    async def test_claim_seat_expired_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        old_token = customer_seat_pending.invitation_token
        customer_seat_pending.invitation_token_expires_at = datetime.now(
            UTC
        ) - timedelta(hours=1)
        await save_fixture(customer_seat_pending)

        assert old_token is not None
        with pytest.raises(InvalidInvitationToken):
            await seat_service.claim_seat(session, old_token)

    @pytest.mark.asyncio
    async def test_claim_seat_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
    ) -> None:
        assert customer_seat_pending.subscription is not None
        customer_seat_pending.subscription.product.organization.feature_settings = {}
        await save_fixture(customer_seat_pending.subscription.product.organization)

        assert customer_seat_pending.invitation_token is not None
        with pytest.raises(FeatureNotEnabled):
            await seat_service.claim_seat(
                session,
                customer_seat_pending.invitation_token,
            )

    @pytest.mark.asyncio
    async def test_claim_seat_clears_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that claiming a seat clears the invitation token (single-use)."""
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
        )
        await session.refresh(seat, ["subscription"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        assert seat.invitation_token is not None
        old_token = seat.invitation_token

        claimed_seat, _ = await seat_service.claim_seat(session, old_token)

        assert claimed_seat.invitation_token is None

    @pytest.mark.asyncio
    async def test_claim_seat_sends_webhook(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        seat_pending = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
        )
        await session.refresh(seat_pending, ["subscription"])
        assert seat_pending.subscription is not None
        await session.refresh(seat_pending.subscription, ["product"])
        await session.refresh(seat_pending.subscription.product, ["organization"])

        assert seat_pending.invitation_token is not None

        with patch("polar.webhook.service.webhook.send") as mock_send:
            mock_send.return_value = []
            seat, _ = await seat_service.claim_seat(
                session, seat_pending.invitation_token
            )

            mock_send.assert_called_once()
            args = mock_send.call_args
            assert args[0][1].id == subscription_with_seats.product.organization.id
            assert args[0][2] == WebhookEventType.customer_seat_claimed
            assert args[0][3].id == seat.id


class TestRevokeSeat:
    @pytest.mark.asyncio
    async def test_revoke_seat_success(
        self, session: AsyncSession, customer_seat_claimed: CustomerSeat
    ) -> None:
        seat = await seat_service.revoke_seat(session, customer_seat_claimed)

        assert seat.status == SeatStatus.revoked
        assert seat.revoked_at is not None
        assert seat.customer_id is None
        assert seat.invitation_token is None
        assert isinstance(seat.revoked_at, datetime)

    @pytest.mark.asyncio
    async def test_revoke_seat_pending(
        self, session: AsyncSession, customer_seat_pending: CustomerSeat
    ) -> None:
        seat = await seat_service.revoke_seat(session, customer_seat_pending)

        assert seat.status == SeatStatus.revoked
        assert seat.revoked_at is not None

    @pytest.mark.asyncio
    async def test_revoke_seat_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_claimed: CustomerSeat,
    ) -> None:
        assert customer_seat_claimed.subscription is not None
        customer_seat_claimed.subscription.product.organization.feature_settings = {}
        await save_fixture(customer_seat_claimed.subscription.product.organization)

        with pytest.raises(FeatureNotEnabled):
            await seat_service.revoke_seat(session, customer_seat_claimed)

    @pytest.mark.asyncio
    async def test_revoke_seat_sends_webhook(
        self, session: AsyncSession, customer_seat_claimed: CustomerSeat
    ) -> None:
        with patch("polar.webhook.service.webhook.send") as mock_send:
            mock_send.return_value = []
            seat = await seat_service.revoke_seat(session, customer_seat_claimed)

            mock_send.assert_called_once()
            args = mock_send.call_args
            assert customer_seat_claimed.subscription is not None
            assert (
                args[0][1].id
                == customer_seat_claimed.subscription.product.organization.id
            )
            assert args[0][2] == WebhookEventType.customer_seat_revoked
            assert args[0][3].id == seat.id


class TestGetSeat:
    @pytest.mark.asyncio
    async def test_get_seat_as_organization(
        self,
        session: AsyncSession,
        customer_seat_claimed: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        auth_subject = AuthSubject(
            subject=seat_enabled_organization, scopes=set(), session=None
        )

        seat = await seat_service.get_seat(
            session, auth_subject, customer_seat_claimed.id
        )

        assert seat is not None
        assert seat.id == customer_seat_claimed.id

    @pytest.mark.asyncio
    async def test_get_seat_as_user(
        self, session: AsyncSession, customer_seat_claimed: CustomerSeat, user: User
    ) -> None:
        auth_subject = AuthSubject(subject=user, scopes=set(), session=None)

        seat = await seat_service.get_seat(
            session, auth_subject, customer_seat_claimed.id
        )

        assert seat is not None
        assert seat.id == customer_seat_claimed.id

    @pytest.mark.asyncio
    async def test_get_seat_wrong_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create a different organization (not seat-enabled)
        different_org = await create_organization(save_fixture)
        auth_subject = AuthSubject(subject=different_org, scopes=set(), session=None)

        # Create a seat with seat-enabled organization
        seat_enabled_org = await create_organization(save_fixture)
        seat_enabled_org.feature_settings = {"seat_based_pricing_enabled": True}
        await save_fixture(seat_enabled_org)

        seat_product = await create_product(
            save_fixture,
            organization=seat_enabled_org,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        await create_product_price_seat_unit(
            save_fixture, product=seat_product, price_per_seat=1000
        )
        seat_subscription = await create_subscription_with_seats(
            save_fixture, product=seat_product, customer=customer, seats=5
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=seat_subscription,
            customer=customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )

        result = await seat_service.get_seat(session, auth_subject, seat.id)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_seat_not_found(self, session: AsyncSession, user: User) -> None:
        auth_subject = AuthSubject(subject=user, scopes=set(), session=None)

        seat = await seat_service.get_seat(session, auth_subject, uuid.uuid4())

        assert seat is None

    @pytest.mark.asyncio
    async def test_get_seat_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_claimed: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        seat_enabled_organization.feature_settings = {}
        await save_fixture(seat_enabled_organization)

        auth_subject = AuthSubject(
            subject=seat_enabled_organization, scopes=set(), session=None
        )

        with pytest.raises(FeatureNotEnabled):
            await seat_service.get_seat(session, auth_subject, customer_seat_claimed.id)


class TestResendInvitation:
    @pytest.mark.asyncio
    async def test_resend_invitation_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test resending invitation for a pending seat."""
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
            status=SeatStatus.pending,
        )
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        original_token = seat.invitation_token

        with patch(
            "polar.customer_seat.service.send_seat_invitation_email"
        ) as mock_send_email:
            result_seat = await seat_service.resend_invitation(session, seat)

            # Verify the seat is still pending
            assert result_seat.status == SeatStatus.pending
            assert result_seat.id == seat.id
            assert result_seat.invitation_token == original_token

            # Verify email was sent
            mock_send_email.assert_called_once()
            call_kwargs = mock_send_email.call_args[1]
            assert call_kwargs["customer_email"] == customer.email
            assert call_kwargs["seat"] == seat
            assert (
                call_kwargs["organization"]
                == subscription_with_seats.product.organization
            )
            assert call_kwargs["product_name"] == subscription_with_seats.product.name
            assert (
                call_kwargs["billing_manager_email"]
                == subscription_with_seats.customer.email
            )

    @pytest.mark.asyncio
    async def test_resend_invitation_not_pending(
        self,
        session: AsyncSession,
        customer_seat_claimed: CustomerSeat,
    ) -> None:
        """Test that resending invitation for a claimed seat raises an error."""
        with pytest.raises(SeatNotPending):
            await seat_service.resend_invitation(session, customer_seat_claimed)

    @pytest.mark.asyncio
    async def test_resend_invitation_no_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that resending invitation without a customer raises an error."""
        # Create a pending seat without a customer (edge case)
        seat = CustomerSeat(
            subscription_id=subscription_with_seats.id,
            status=SeatStatus.pending,
            invitation_token="test-token",
        )
        await save_fixture(seat)
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        with pytest.raises(InvalidInvitationToken):
            await seat_service.resend_invitation(session, seat)

    @pytest.mark.asyncio
    async def test_resend_invitation_no_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that resending invitation without a token raises an error."""
        # Create a pending seat without an invitation token (edge case)
        seat = CustomerSeat(
            subscription_id=subscription_with_seats.id,
            customer_id=customer.id,
            status=SeatStatus.pending,
            invitation_token=None,
        )
        await save_fixture(seat)
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        with pytest.raises(InvalidInvitationToken):
            await seat_service.resend_invitation(session, seat)

    @pytest.mark.asyncio
    async def test_resend_invitation_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that resending invitation fails when feature is disabled."""
        # Create a pending seat
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
            status=SeatStatus.pending,
        )
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        # Disable feature
        subscription_with_seats.product.organization.feature_settings = {}
        await save_fixture(subscription_with_seats.product.organization)

        with pytest.raises(FeatureNotEnabled):
            await seat_service.resend_invitation(session, seat)

    @pytest.mark.asyncio
    async def test_resend_invitation_revoked_seat(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that resending invitation for a revoked seat raises an error."""
        # Create and revoke a seat
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
            status=SeatStatus.revoked,
        )
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        with pytest.raises(SeatNotPending):
            await seat_service.resend_invitation(session, seat)


class TestBenefitGranting:
    """Tests for benefit granting when claiming and revoking seats."""

    @pytest.mark.asyncio
    async def test_claim_seat_enqueues_benefit_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that claiming a seat enqueues benefit grants for the customer."""
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
        )
        await session.refresh(seat, ["subscription"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        assert seat.invitation_token is not None

        with patch("polar.customer_seat.service.enqueue_job") as mock_enqueue_job:
            claimed_seat, _ = await seat_service.claim_seat(
                session, seat.invitation_token
            )
            assert claimed_seat.subscription is not None

            mock_enqueue_job.assert_called_once_with(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=customer.id,
                product_id=claimed_seat.subscription.product_id,
                member_id=claimed_seat.member_id,
                subscription_id=claimed_seat.subscription_id,
            )

    @pytest.mark.asyncio
    async def test_revoke_seat_enqueues_benefit_revocation(
        self, session: AsyncSession, customer_seat_claimed: CustomerSeat
    ) -> None:
        """Test that revoking a seat enqueues benefit revocation."""
        original_customer_id = customer_seat_claimed.customer_id
        original_member_id = customer_seat_claimed.member_id
        assert original_customer_id is not None

        with patch("polar.customer_seat.service.enqueue_job") as mock_enqueue_job:
            seat = await seat_service.revoke_seat(session, customer_seat_claimed)
            assert seat.subscription is not None

            mock_enqueue_job.assert_called_once_with(
                "benefit.enqueue_benefits_grants",
                task="revoke",
                customer_id=original_customer_id,
                product_id=seat.subscription.product_id,
                member_id=original_member_id,
                subscription_id=seat.subscription_id,
            )

    @pytest.mark.asyncio
    async def test_revoke_pending_seat_does_not_enqueue_revocation(
        self, session: AsyncSession, customer_seat_pending: CustomerSeat
    ) -> None:
        """Test that revoking a pending seat (no customer) doesn't enqueue revocation."""
        assert customer_seat_pending.customer_id is None

        with patch("polar.customer_seat.service.enqueue_job") as mock_enqueue_job:
            await seat_service.revoke_seat(session, customer_seat_pending)

            mock_enqueue_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_claim_seat_publishes_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer: Customer,
    ) -> None:
        """Test that claiming a seat publishes an event to the event stream."""
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer,
        )
        await session.refresh(seat, ["subscription"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        assert seat.invitation_token is not None

        with patch("polar.customer_seat.service.eventstream_publish") as mock_publish:
            claimed_seat, _ = await seat_service.claim_seat(
                session, seat.invitation_token
            )

            mock_publish.assert_called_once()
            call_args = mock_publish.call_args
            assert call_args[0][0] == "customer_seat.claimed"
            assert call_args[0][1]["seat_id"] == str(claimed_seat.id)
            assert call_args[0][1]["subscription_id"] == str(
                claimed_seat.subscription_id
            )
            assert call_args[1]["customer_id"] == customer.id


class TestRevokeAllSeatsForSubscription:
    """Tests for revoking all seats when a subscription is cancelled."""

    @pytest.mark.asyncio
    async def test_revoke_all_seats_for_subscription_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that all active seats are revoked when subscription is cancelled."""
        # Create multiple claimed seats
        customer1 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer2@example.com",
        )
        customer3 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer3@example.com",
        )

        seat1 = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer1,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        seat2 = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer2,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        # Create a pending seat as well
        seat3 = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer3,
            status=SeatStatus.pending,
        )

        await session.refresh(subscription_with_seats, ["product"])
        await session.refresh(subscription_with_seats.product, ["organization"])

        # Revoke all seats for the subscription
        revoked_count = await seat_service.revoke_all_seats_for_subscription(
            session, subscription_with_seats
        )

        # Should have revoked 3 seats (2 claimed + 1 pending)
        assert revoked_count == 3

        # Verify all seats are now revoked
        await session.refresh(seat1)
        await session.refresh(seat2)
        await session.refresh(seat3)

        assert seat1.status == SeatStatus.revoked
        assert seat1.revoked_at is not None
        assert seat1.customer_id is None

        assert seat2.status == SeatStatus.revoked
        assert seat2.revoked_at is not None
        assert seat2.customer_id is None

        assert seat3.status == SeatStatus.revoked
        assert seat3.revoked_at is not None
        assert seat3.customer_id is None

    @pytest.mark.asyncio
    async def test_revoke_all_seats_skips_already_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that already-revoked seats are skipped."""
        customer1 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer2@example.com",
        )

        # Create one claimed seat
        seat1 = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer1,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        # Create one already-revoked seat
        seat2 = await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer2,
            status=SeatStatus.revoked,
            revoked_at=utc_now(),
        )

        await session.refresh(subscription_with_seats, ["product"])
        await session.refresh(subscription_with_seats.product, ["organization"])

        # Revoke all seats
        revoked_count = await seat_service.revoke_all_seats_for_subscription(
            session, subscription_with_seats
        )

        # Should have revoked only 1 seat (the claimed one)
        assert revoked_count == 1

        # Verify seat1 is revoked
        await session.refresh(seat1)
        assert seat1.status == SeatStatus.revoked

    @pytest.mark.asyncio
    async def test_revoke_all_seats_no_active_seats(
        self,
        session: AsyncSession,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that revoking when there are no active seats returns 0."""
        await session.refresh(subscription_with_seats, ["product"])
        await session.refresh(subscription_with_seats.product, ["organization"])

        revoked_count = await seat_service.revoke_all_seats_for_subscription(
            session, subscription_with_seats
        )

        assert revoked_count == 0

    @pytest.mark.asyncio
    async def test_revoke_all_seats_enqueues_benefit_revocations(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
    ) -> None:
        """Test that revoking all seats enqueues benefit revocations for each seat holder."""
        customer1 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="customer2@example.com",
        )

        await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer1,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription_with_seats,
            customer=customer2,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )

        await session.refresh(subscription_with_seats, ["product"])
        await session.refresh(subscription_with_seats.product, ["organization"])

        with patch("polar.customer_seat.service.enqueue_job") as mock_enqueue_job:
            revoked_count = await seat_service.revoke_all_seats_for_subscription(
                session, subscription_with_seats
            )

            # Should have revoked 2 seats
            assert revoked_count == 2

            # Should have enqueued 2 benefit revocations
            assert mock_enqueue_job.call_count == 2

            # Verify both calls were for benefit revocation
            for call in mock_enqueue_job.call_args_list:
                assert call[0][0] == "benefit.enqueue_benefits_grants"
                assert call[1]["task"] == "revoke"
                assert call[1]["product_id"] == subscription_with_seats.product_id
                assert call[1]["subscription_id"] == subscription_with_seats.id
                # Customer ID should be either customer1 or customer2
                assert call[1]["customer_id"] in [customer1.id, customer2.id]
