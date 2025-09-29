import secrets
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, CustomerSeat, Organization, Subscription, User
from polar.models.customer_seat import SeatStatus
from polar.postgres import AsyncReadSession

from .repository import CustomerSeatRepository

log = structlog.get_logger()


class SeatError(PolarError): ...


class SeatNotAvailable(SeatError):
    def __init__(self, subscription_id: uuid.UUID) -> None:
        self.subscription_id = subscription_id
        message = f"No available seats for subscription {subscription_id}"
        super().__init__(message, 400)


class InvalidInvitationToken(SeatError):
    def __init__(self, token: str) -> None:
        self.token = token
        message = "Invalid or expired invitation token"
        super().__init__(message, 400)


class FeatureNotEnabled(SeatError):
    def __init__(self) -> None:
        message = "Seat-based pricing is not enabled for this organization"
        super().__init__(message, 403)


class SeatAlreadyAssigned(SeatError):
    def __init__(self, customer_email: str) -> None:
        self.customer_email = customer_email
        message = f"Seat already assigned to customer {customer_email}"
        super().__init__(message, 400)


class InvalidSeatAssignmentRequest(SeatError):
    def __init__(self) -> None:
        message = "Exactly one of email, external_customer_id, or customer_id must be provided"
        super().__init__(message, 400)


class CustomerNotFound(SeatError):
    def __init__(self, customer_identifier: str) -> None:
        self.customer_identifier = customer_identifier
        message = f"Customer not found: {customer_identifier}"
        super().__init__(message, 404)


class SeatService:
    def check_seat_feature_enabled(self, organization: Organization) -> None:
        if not organization.feature_settings.get("seat_based_pricing_enabled", False):
            raise FeatureNotEnabled()

    async def list_seats(
        self,
        session: AsyncReadSession,
        subscription: Subscription,
    ) -> Sequence[CustomerSeat]:
        self.check_seat_feature_enabled(subscription.product.organization)

        repository = CustomerSeatRepository.from_session(session)
        return await repository.list_by_subscription_id(
            subscription.id,
            options=repository.get_eager_options(),
        )

    async def get_available_seats_count(
        self,
        session: AsyncReadSession,
        subscription: Subscription,
    ) -> int:
        self.check_seat_feature_enabled(subscription.product.organization)

        repository = CustomerSeatRepository.from_session(session)
        return await repository.get_available_seats_count(subscription.id)

    async def assign_seat(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        email: str | None = None,
        external_customer_id: str | None = None,
        customer_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CustomerSeat:
        self.check_seat_feature_enabled(subscription.product.organization)

        repository = CustomerSeatRepository.from_session(session)

        available_seats = await repository.get_available_seats_count(subscription.id)
        if available_seats <= 0:
            raise SeatNotAvailable(subscription.id)

        customer = await self._find_customer(
            session,
            subscription.product.organization_id,
            email,
            external_customer_id,
            customer_id,
        )

        if not customer:
            raise CustomerNotFound(email or external_customer_id or str(customer_id))

        existing_seat = await repository.get_by_subscription_and_customer(
            subscription.id, customer.id
        )
        if existing_seat and not existing_seat.is_revoked():
            identifier = email or external_customer_id or str(customer_id)
            raise SeatAlreadyAssigned(identifier)

        invitation_token = secrets.token_urlsafe(32)

        seat = CustomerSeat(
            subscription_id=subscription.id,
            status=SeatStatus.pending,
            invitation_token=invitation_token,
            seat_metadata=metadata or {},
        )

        seat.customer_id = customer.id

        session.add(seat)

        log.info(
            "Seat assigned",
            subscription_id=subscription.id,
            email=email,
            customer_id=customer.id,
            invitation_token=invitation_token,
        )

        return seat

    async def claim_seat(
        self,
        session: AsyncSession,
        invitation_token: str,
        customer: Customer,
    ) -> CustomerSeat:
        repository = CustomerSeatRepository.from_session(session)

        seat = await repository.get_by_invitation_token(
            invitation_token,
            options=(
                joinedload(CustomerSeat.subscription).joinedload(Subscription.product),
            ),
        )

        if not seat or seat.is_revoked():
            raise InvalidInvitationToken(invitation_token)

        self.check_seat_feature_enabled(seat.subscription.product.organization)

        # Update seat status
        seat.customer_id = customer.id
        seat.status = SeatStatus.claimed
        seat.claimed_at = datetime.now(UTC)

        log.info(
            "Seat claimed",
            seat_id=seat.id,
            customer_id=customer.id,
            subscription_id=seat.subscription_id,
        )

        return seat

    async def revoke_seat(
        self,
        session: AsyncSession,
        seat: CustomerSeat,
    ) -> CustomerSeat:
        if seat.subscription and seat.subscription.product:
            self.check_seat_feature_enabled(seat.subscription.product.organization)

        seat.status = SeatStatus.revoked
        seat.revoked_at = datetime.now(UTC)
        seat.customer_id = None
        seat.invitation_token = None

        log.info(
            "Seat revoked",
            seat_id=seat.id,
            subscription_id=seat.subscription_id,
        )

        return seat

    async def get_seat(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        seat_id: uuid.UUID,
    ) -> CustomerSeat | None:
        repository = CustomerSeatRepository.from_session(session)

        statement = (
            repository.get_base_statement()
            .where(CustomerSeat.id == seat_id)
            .options(*repository.get_eager_options())
        )
        seat = await repository.get_one_or_none(statement)

        if not seat:
            return None

        if isinstance(auth_subject.subject, Organization):
            if seat.subscription.product.organization_id != auth_subject.subject.id:
                return None
        elif isinstance(auth_subject.subject, User):
            pass

        self.check_seat_feature_enabled(seat.subscription.product.organization)
        return seat

    async def _find_customer(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        email: str | None,
        external_customer_id: str | None,
        customer_id: uuid.UUID | None,
    ) -> Customer | None:
        # Validate that exactly one identifier is provided
        provided_identifiers = [email, external_customer_id, customer_id]
        non_null_count = sum(
            1 for identifier in provided_identifiers if identifier is not None
        )

        if non_null_count != 1:
            raise InvalidSeatAssignmentRequest()

        customer_repository = CustomerRepository.from_session(session)
        customer = None

        # Find customer based on provided identifier
        if email:
            customer = await customer_repository.get_by_email_and_organization(
                email, organization_id
            )
        elif external_customer_id:
            customer = await customer_repository.get_by_external_id_and_organization(
                external_customer_id, organization_id
            )
        elif customer_id:
            customer = await customer_repository.get_by_id_and_organization(
                customer_id, organization_id
            )
        return customer


seat_service = SeatService()
