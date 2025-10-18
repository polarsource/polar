import secrets
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from polar.auth.models import AuthSubject
from polar.customer.repository import BaseCustomerRepository
from polar.customer_seat.sender import send_seat_invitation_email
from polar.customer_session.service import (
    customer_session as customer_session_service,
)
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, CustomerSeat, Organization, Subscription, User
from polar.models.customer_seat import SeatStatus
from polar.postgres import AsyncReadSession
from polar.worker import enqueue_job

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


class SeatNotPending(SeatError):
    def __init__(self) -> None:
        message = "Seat is not in pending status"
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

        customer = await self._find__or_create_customer(
            session,
            subscription.product.organization_id,
            email,
            external_customer_id,
            customer_id,
        )

        existing_seat = await repository.get_by_subscription_and_customer(
            subscription.id, customer.id
        )
        if existing_seat and not existing_seat.is_revoked():
            identifier = email or external_customer_id or str(customer_id)
            raise SeatAlreadyAssigned(identifier)

        invitation_token = secrets.token_urlsafe(32)
        token_expires_at = datetime.now(UTC) + timedelta(days=1)

        # First, try to reuse a revoked seat from this subscription
        revoked_seat = await repository.get_revoked_seat_by_subscription(
            subscription.id
        )
        if revoked_seat:
            seat = revoked_seat
            seat.status = SeatStatus.pending
            seat.invitation_token = invitation_token
            seat.invitation_token_expires_at = token_expires_at
            seat.customer_id = customer.id
            seat.seat_metadata = metadata or {}
            seat.revoked_at = None
            seat.claimed_at = None
        else:
            seat = CustomerSeat(
                subscription_id=subscription.id,
                status=SeatStatus.pending,
                invitation_token=invitation_token,
                invitation_token_expires_at=token_expires_at,
                customer_id=customer.id,
                seat_metadata=metadata or {},
            )
            session.add(seat)

        await session.flush()

        log.info(
            "Seat assigned",
            subscription_id=subscription.id,
            email=email,
            customer_id=customer.id,
            invitation_token=invitation_token,
        )

        send_seat_invitation_email(
            customer_email=customer.email,
            seat=seat,
            organization=subscription.product.organization,
            product_name=subscription.product.name,
            billing_manager_email=subscription.customer.email,
        )

        return seat

    async def get_seat_by_token(
        self,
        session: AsyncReadSession,
        invitation_token: str,
    ) -> CustomerSeat | None:
        repository = CustomerSeatRepository.from_session(session)
        seat = await repository.get_by_invitation_token(
            invitation_token,
            options=repository.get_eager_options(),
        )

        if not seat or seat.is_revoked() or seat.is_claimed():
            return None

        if (
            seat.invitation_token_expires_at
            and seat.invitation_token_expires_at < datetime.now(UTC)
        ):
            return None

        return seat

    async def claim_seat(
        self,
        session: AsyncSession,
        invitation_token: str,
        request_metadata: dict[str, Any] | None = None,
    ) -> tuple[CustomerSeat, str]:
        repository = CustomerSeatRepository.from_session(session)

        seat = await repository.get_by_invitation_token(
            invitation_token,
            options=repository.get_eager_options(),
        )

        if not seat or seat.is_revoked():
            raise InvalidInvitationToken(invitation_token)

        if (
            seat.invitation_token_expires_at
            and seat.invitation_token_expires_at < datetime.now(UTC)
        ):
            raise InvalidInvitationToken(invitation_token)

        # Reject already-claimed tokens for security
        if seat.is_claimed():
            raise InvalidInvitationToken(invitation_token)

        self.check_seat_feature_enabled(seat.subscription.product.organization)

        if not seat.customer_id or not seat.customer:
            raise InvalidInvitationToken(invitation_token)

        seat.status = SeatStatus.claimed
        seat.claimed_at = datetime.now(UTC)
        seat.invitation_token = None  # Single-use token

        await session.flush()

        await eventstream_publish(
            "customer_seat.claimed",
            {
                "seat_id": str(seat.id),
                "subscription_id": str(seat.subscription_id),
                "product_id": str(seat.subscription.product_id),
            },
            customer_id=seat.customer_id,
        )

        # Grant benefits to the assigned customer
        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=seat.customer_id,
            product_id=seat.subscription.product_id,
            subscription_id=seat.subscription_id,
        )

        session_token, _ = await customer_session_service.create_customer_session(
            session, seat.customer
        )

        log.info(
            "Seat claimed",
            seat_id=seat.id,
            customer_id=seat.customer_id,
            subscription_id=seat.subscription_id,
            **(request_metadata or {}),
        )

        return seat, session_token

    async def revoke_seat(
        self,
        session: AsyncSession,
        seat: CustomerSeat,
    ) -> CustomerSeat:
        if seat.subscription and seat.subscription.product:
            self.check_seat_feature_enabled(seat.subscription.product.organization)

        # Capture customer_id before clearing to avoid race condition
        original_customer_id = seat.customer_id

        # Revoke benefits from the customer before clearing the customer_id
        if original_customer_id:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="revoke",
                customer_id=original_customer_id,
                product_id=seat.subscription.product_id,
                subscription_id=seat.subscription_id,
            )

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

        seat = await repository.get_by_id(
            seat_id,
            options=repository.get_eager_options(),
        )

        if not seat:
            return None

        if isinstance(auth_subject.subject, Organization):
            if seat.subscription.product.organization_id != auth_subject.subject.id:
                return None
        elif isinstance(auth_subject.subject, User):
            pass

        self.check_seat_feature_enabled(seat.subscription.product.organization)
        return seat

    async def resend_invitation(
        self,
        session: AsyncSession,
        seat: CustomerSeat,
    ) -> CustomerSeat:
        if seat.subscription and seat.subscription.product:
            self.check_seat_feature_enabled(seat.subscription.product.organization)

        if not seat.is_pending():
            raise SeatNotPending()

        if not seat.customer or not seat.invitation_token:
            raise InvalidInvitationToken(seat.invitation_token or "")

        log.info(
            "Resending seat invitation",
            seat_id=seat.id,
            customer_id=seat.customer_id,
            subscription_id=seat.subscription_id,
        )

        send_seat_invitation_email(
            customer_email=seat.customer.email,
            seat=seat,
            organization=seat.subscription.product.organization,
            product_name=seat.subscription.product.name,
            billing_manager_email=seat.subscription.customer.email,
        )

        return seat

    async def get_seat_for_customer(
        self,
        session: AsyncReadSession,
        customer: Customer,
        seat_id: uuid.UUID,
    ) -> CustomerSeat | None:
        """Get a seat and verify it belongs to a subscription owned by the customer."""
        repository = CustomerSeatRepository.from_session(session)

        seat = await repository.get_by_id_for_customer(
            seat_id,
            customer.id,
            options=repository.get_eager_options(),
        )

        return seat

    async def revoke_all_seats_for_subscription(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> int:
        """
        Revoke all non-revoked seats for a subscription.

        This is typically called when a subscription is cancelled to ensure
        all seat holders lose access to their benefits.

        Returns the number of seats revoked.
        """
        repository = CustomerSeatRepository.from_session(session)

        all_seats = await repository.list_by_subscription_id(
            subscription.id,
            options=repository.get_eager_options(),
        )

        active_seats = [seat for seat in all_seats if not seat.is_revoked()]

        revoked_count = 0
        for seat in active_seats:
            await self.revoke_seat(session, seat)
            revoked_count += 1

        if revoked_count > 0:
            await session.flush()
            log.info(
                "Revoked all seats for subscription",
                subscription_id=subscription.id,
                seats_revoked=revoked_count,
            )

        return revoked_count

    async def _find__or_create_customer(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        email: str | None,
        external_customer_id: str | None,
        customer_id: uuid.UUID | None,
    ) -> Customer:
        # Validate that exactly one identifier is provided
        provided_identifiers = [email, external_customer_id, customer_id]
        non_null_count = sum(
            1 for identifier in provided_identifiers if identifier is not None
        )

        if non_null_count != 1:
            raise InvalidSeatAssignmentRequest()

        base_customer_repository = BaseCustomerRepository.from_session(session)
        customer = None

        # Find customer based on provided identifier
        if email:
            # Email lookup still needs CustomerRepository since it's specific to non-placeholder customers
            from polar.customer.repository import CustomerRepository

            customer_repository = CustomerRepository.from_session(session)
            customer = await customer_repository.get_by_email_and_organization(
                email, organization_id
            )
        elif external_customer_id:
            base_customer = (
                await base_customer_repository.get_by_external_id_and_organization(
                    external_customer_id, organization_id
                )
            )
            # Assert that if we found a customer, it's a real Customer (not a placeholder)
            customer = (
                base_customer
                if base_customer and isinstance(base_customer, Customer)
                else None
            )
        elif customer_id:
            base_customer = await base_customer_repository.get_by_id_and_organization(
                customer_id, organization_id
            )
            # Assert that if we found a customer, it's a real Customer (not a placeholder)
            customer = (
                base_customer
                if base_customer and isinstance(base_customer, Customer)
                else None
            )

        if not customer and not email:
            raise CustomerNotFound(external_customer_id or str(customer_id))
        elif not customer:
            customer = Customer(
                organization_id=organization_id,
                email=email,
            )
            session.add(customer)
            await session.flush()
        return customer


seat_service = SeatService()
