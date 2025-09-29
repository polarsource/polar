import uuid
from datetime import datetime

import pytest

from polar.customer_seat.service import (
    CustomerNotFound,
    FeatureNotEnabled,
    InvalidInvitationToken,
    InvalidSeatAssignmentRequest,
    SeatAlreadyAssigned,
    SeatNotAvailable,
    seat_service,
)
from polar.models import Customer, Organization, Product, Subscription, User
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


class TestCheckSeatFeatureEnabled:
    def test_feature_enabled(self) -> None:
        organization = Organization(
            feature_settings={"seat_based_pricing_enabled": True}
        )
        seat_service.check_seat_feature_enabled(organization)

    def test_feature_disabled(self) -> None:
        organization = Organization(
            feature_settings={"seat_based_pricing_enabled": False}
        )
        with pytest.raises(FeatureNotEnabled):
            seat_service.check_seat_feature_enabled(organization)

    def test_feature_missing(self) -> None:
        organization = Organization(feature_settings={})
        with pytest.raises(FeatureNotEnabled):
            seat_service.check_seat_feature_enabled(organization)


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
        # Create a customer with the email first
        from tests.fixtures.random_objects import create_customer

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
        # Create a customer with the external_customer_id first
        from tests.fixtures.random_objects import create_customer

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
        # Create a customer with the email first
        from tests.fixtures.random_objects import create_customer

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
        with pytest.raises(CustomerNotFound) as exc_info:
            await seat_service.assign_seat(
                session, subscription_with_seats, email="nonexistent@example.com"
            )
        assert "nonexistent@example.com" in str(exc_info.value)

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
        import uuid

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


class TestClaimSeat:
    @pytest.mark.asyncio
    async def test_claim_seat_success(
        self,
        session: AsyncSession,
        customer_seat_pending: CustomerSeat,
        customer: Customer,
    ) -> None:
        assert customer_seat_pending.invitation_token is not None
        seat = await seat_service.claim_seat(
            session, customer_seat_pending.invitation_token, customer
        )

        assert seat.customer_id == customer.id
        assert seat.status == SeatStatus.claimed
        assert seat.claimed_at is not None
        assert isinstance(seat.claimed_at, datetime)

    @pytest.mark.asyncio
    async def test_claim_seat_invalid_token(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        with pytest.raises(InvalidInvitationToken):
            await seat_service.claim_seat(session, "invalid_token", customer)

    @pytest.mark.asyncio
    async def test_claim_seat_revoked_seat(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
        customer: Customer,
    ) -> None:
        customer_seat_pending.status = SeatStatus.revoked
        await save_fixture(customer_seat_pending)

        assert customer_seat_pending.invitation_token is not None
        with pytest.raises(InvalidInvitationToken):
            await seat_service.claim_seat(
                session,
                customer_seat_pending.invitation_token,
                customer,
            )

    @pytest.mark.asyncio
    async def test_claim_seat_feature_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_seat_pending: CustomerSeat,
        customer: Customer,
    ) -> None:
        customer_seat_pending.subscription.product.organization.feature_settings = {}
        await save_fixture(customer_seat_pending.subscription.product.organization)

        assert customer_seat_pending.invitation_token is not None
        with pytest.raises(FeatureNotEnabled):
            await seat_service.claim_seat(
                session,
                customer_seat_pending.invitation_token,
                customer,
            )


class TestRevokeSeat:
    @pytest.mark.asyncio
    async def test_revoke_seat_success(
        self, session: AsyncSession, customer_seat_claimed: CustomerSeat
    ) -> None:
        original_customer_id = customer_seat_claimed.customer_id
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
        customer_seat_claimed.subscription.product.organization.feature_settings = {}
        await save_fixture(customer_seat_claimed.subscription.product.organization)

        with pytest.raises(FeatureNotEnabled):
            await seat_service.revoke_seat(session, customer_seat_claimed)


class TestGetSeat:
    @pytest.mark.asyncio
    async def test_get_seat_as_organization(
        self,
        session: AsyncSession,
        customer_seat_claimed: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        from polar.auth.models import AuthSubject

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
        from polar.auth.models import AuthSubject

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
        from polar.auth.models import AuthSubject
        from polar.kit.utils import utc_now
        from polar.models.customer_seat import SeatStatus
        from tests.fixtures.random_objects import (
            create_customer_seat,
            create_organization,
            create_subscription_with_seats,
        )

        # Create a different organization (not seat-enabled)
        different_org = await create_organization(save_fixture)
        auth_subject = AuthSubject(subject=different_org, scopes=set(), session=None)

        # Create a seat with seat-enabled organization
        seat_enabled_org = await create_organization(save_fixture)
        seat_enabled_org.feature_settings = {"seat_based_pricing_enabled": True}
        await save_fixture(seat_enabled_org)

        from polar.enums import SubscriptionRecurringInterval
        from tests.fixtures.random_objects import (
            create_product,
            create_product_price_seat_unit,
        )

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
        from polar.auth.models import AuthSubject

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
        from polar.auth.models import AuthSubject

        seat_enabled_organization.feature_settings = {}
        await save_fixture(seat_enabled_organization)

        auth_subject = AuthSubject(
            subject=seat_enabled_organization, scopes=set(), session=None
        )

        with pytest.raises(FeatureNotEnabled):
            await seat_service.get_seat(session, auth_subject, customer_seat_claimed.id)
