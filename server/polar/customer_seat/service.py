import secrets
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from polar.auth.models import AuthSubject
from polar.customer.repository import CustomerRepository
from polar.customer_seat.sender import send_seat_invitation_email
from polar.customer_session.service import (
    customer_session as customer_session_service,
)
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.member_session.service import member_session as member_session_service
from polar.models import (
    Customer,
    CustomerSeat,
    Member,
    Order,
    Organization,
    Product,
    Subscription,
    User,
)
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole
from polar.models.order import OrderStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import CustomerSeatRepository

log = structlog.get_logger()


class SeatError(PolarError): ...


class SeatNotAvailable(SeatError):
    def __init__(self, source_id: uuid.UUID, reason: str | None = None) -> None:
        self.source_id = source_id
        message = reason or f"No available seats for {source_id}"
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
    def __init__(self, message: str | None = None) -> None:
        if message is None:
            message = "Exactly one of email, external_customer_id, or customer_id must be provided"
        super().__init__(message, 400)


class CustomerNotFound(SeatError):
    def __init__(self, customer_identifier: str) -> None:
        self.customer_identifier = customer_identifier
        message = f"Customer not found: {customer_identifier}"
        super().__init__(message, 404)


SeatContainer = Subscription | Order


@dataclass
class SeatAssignmentTarget:
    """Resolved target for a seat assignment.

    This dataclass unifies the result of resolving who a seat is being assigned to,
    regardless of whether member_model_enabled is True or False.
    """

    customer_id: uuid.UUID
    """The customer_id to store on the seat.
    - member_model_enabled=True: billing customer (purchaser)
    - member_model_enabled=False: seat member's customer
    """

    member_id: uuid.UUID | None
    """The member_id to store on the seat (if member was created)."""

    email: str | None
    """The email to store on the seat.
    - member_model_enabled=True: seat member's email
    - member_model_enabled=False: None (email comes from customer)
    """

    seat_member_email: str
    """The email of the person getting the seat (for invitation emails)."""


class SeatService:
    def _get_product(self, container: SeatContainer) -> Product | None:
        return container.product

    def _get_organization_id(self, container: SeatContainer) -> uuid.UUID:
        return container.organization.id

    def _get_container_id(self, container: SeatContainer) -> uuid.UUID:
        return container.id

    def _is_subscription(self, container: SeatContainer) -> bool:
        return isinstance(container, Subscription)

    async def _enqueue_benefit_grant(
        self, seat: CustomerSeat, product_id: uuid.UUID
    ) -> None:
        """Enqueue benefit grant job for a claimed seat."""
        if seat.subscription_id:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=seat.customer_id,
                product_id=product_id,
                member_id=seat.member_id,
                subscription_id=seat.subscription_id,
            )
        else:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=seat.customer_id,
                product_id=product_id,
                member_id=seat.member_id,
                order_id=seat.order_id,
            )

    async def _publish_seat_claimed_event(
        self, seat: CustomerSeat, product_id: uuid.UUID
    ) -> None:
        """Publish eventstream event for seat claimed."""
        await eventstream_publish(
            "customer_seat.claimed",
            {
                "seat_id": str(seat.id),
                "subscription_id": str(seat.subscription_id)
                if seat.subscription_id
                else None,
                "order_id": str(seat.order_id) if seat.order_id else None,
                "product_id": str(product_id),
            },
            customer_id=seat.customer_id,
        )

    async def _send_seat_claimed_webhook(
        self, session: AsyncSession, organization_id: uuid.UUID, seat: CustomerSeat
    ) -> None:
        """Send webhook for seat claimed."""
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization:
            await webhook_service.send(
                session,
                organization,
                WebhookEventType.customer_seat_claimed,
                seat,
            )

    async def check_seat_feature_enabled(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> None:
        from polar.organization.repository import OrganizationRepository

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if not organization:
            raise FeatureNotEnabled()
        if not organization.feature_settings.get("seat_based_pricing_enabled", False):
            raise FeatureNotEnabled()

    async def list_seats(
        self,
        session: AsyncReadSession,
        container: SeatContainer,
    ) -> Sequence[CustomerSeat]:
        await self.check_seat_feature_enabled(
            session, self._get_organization_id(container)
        )
        repository = CustomerSeatRepository.from_session(session)
        return await repository.list_by_container(
            container,
            options=repository.get_eager_options(),
        )

    async def get_available_seats_count(
        self,
        session: AsyncReadSession,
        container: SeatContainer,
    ) -> int:
        await self.check_seat_feature_enabled(
            session, self._get_organization_id(container)
        )
        repository = CustomerSeatRepository.from_session(session)
        return await repository.get_available_seats_count_for_container(container)

    async def count_assigned_seats_for_subscription(
        self,
        session: AsyncReadSession,
        subscription: Subscription,
    ) -> int:
        repository = CustomerSeatRepository.from_session(session)
        return await repository.count_assigned_seats_for_subscription(subscription.id)

    async def assign_seat(
        self,
        session: AsyncSession,
        container: SeatContainer,
        *,
        email: str | None = None,
        external_customer_id: str | None = None,
        customer_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
        immediate_claim: bool = False,
    ) -> CustomerSeat:
        # 1. Common setup and validation
        product = self._get_product(container)
        source_id = self._get_container_id(container)

        if product is None:
            raise SeatNotAvailable(source_id, "Container has no associated product")

        organization_id = self._get_organization_id(container)
        billing_manager_customer = container.customer
        billing_customer_id = container.customer_id
        is_subscription = self._is_subscription(container)

        await self.check_seat_feature_enabled(session, organization_id)

        if isinstance(container, Order) and container.status == OrderStatus.pending:
            raise SeatNotAvailable(
                source_id, "Order must be paid before assigning seats"
            )

        repository = CustomerSeatRepository.from_session(session)
        available_seats = await repository.get_available_seats_count_for_container(
            container
        )
        if available_seats <= 0:
            raise SeatNotAvailable(source_id)

        # 2. Get organization and check feature flag
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        member_model_enabled = (
            organization.feature_settings.get("member_model_enabled", False)
            if organization
            else False
        )

        # 3. Resolve seat assignment target (the ONLY branching point)
        if member_model_enabled:
            target = await self._resolve_member_model_target(
                session,
                repository,
                container,
                billing_customer_id,
                organization_id,
                email,
                customer_id,
                external_customer_id,
            )
        else:
            target = await self._resolve_legacy_target(
                session,
                repository,
                container,
                organization,
                organization_id,
                email,
                customer_id,
                external_customer_id,
            )

        # 4. Generate invitation token (unified)
        if immediate_claim:
            invitation_token = None
            token_expires_at = None
        else:
            invitation_token = secrets.token_urlsafe(32)
            token_expires_at = datetime.now(UTC) + timedelta(days=1)

        # 5. Create or reuse seat (unified)
        revoked_seat = await repository.get_revoked_seat_by_container(container)

        if revoked_seat:
            seat = revoked_seat
            seat.status = SeatStatus.claimed if immediate_claim else SeatStatus.pending
            seat.invitation_token = invitation_token
            seat.invitation_token_expires_at = token_expires_at
            seat.customer_id = target.customer_id
            seat.member_id = target.member_id
            seat.email = target.email
            seat.seat_metadata = metadata or {}
            seat.revoked_at = None
            seat.claimed_at = datetime.now(UTC) if immediate_claim else None
        else:
            seat_data = {
                "status": SeatStatus.claimed if immediate_claim else SeatStatus.pending,
                "invitation_token": invitation_token,
                "invitation_token_expires_at": token_expires_at,
                "customer_id": target.customer_id,
                "member_id": target.member_id,
                "email": target.email,
                "seat_metadata": metadata or {},
                "claimed_at": datetime.now(UTC) if immediate_claim else None,
            }
            if is_subscription:
                seat_data["subscription_id"] = source_id
            else:
                seat_data["order_id"] = source_id

            seat = CustomerSeat(**seat_data)
            session.add(seat)

        await session.flush()

        # Reload seat with eager-loaded relationships (member, customer, etc.)
        # Required because: (1) newly created seats don't have relationships loaded,
        # (2) webhooks serialize the seat using CustomerSeatSchema which includes member,
        # (3) some code paths (e.g. _resolve_member_model_target) create the member
        #     after the seat object is constructed, so the in-memory seat is stale.
        reloaded_seat = await repository.get_by_id(
            seat.id, options=repository.get_eager_options()
        )
        assert reloaded_seat is not None
        seat = reloaded_seat

        # 6. Post-creation actions (unified)
        if immediate_claim:
            log.info(
                "Seat immediately claimed",
                subscription_id=seat.subscription_id,
                order_id=seat.order_id,
                email=target.seat_member_email,
                customer_id=seat.customer_id,
                member_model_enabled=member_model_enabled,
            )
            await self._publish_seat_claimed_event(seat, product.id)
            await self._enqueue_benefit_grant(seat, product.id)
            await self._send_seat_claimed_webhook(session, organization_id, seat)
        else:
            log.info(
                "Seat assigned",
                subscription_id=seat.subscription_id,
                order_id=seat.order_id,
                email=target.seat_member_email,
                customer_id=seat.customer_id,
                invitation_token=invitation_token or "none",
                member_model_enabled=member_model_enabled,
            )
            if organization:
                send_seat_invitation_email(
                    customer_email=target.seat_member_email,
                    seat=seat,
                    organization=organization,
                    product_name=product.name,
                    billing_manager_email=billing_manager_customer.email,
                )
                await webhook_service.send(
                    session,
                    organization,
                    WebhookEventType.customer_seat_assigned,
                    seat,
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

        # Get product and organization from either subscription or order
        if seat.subscription_id and seat.subscription:
            product = seat.subscription.product
            organization = product.organization
        elif seat.order_id and seat.order:
            assert seat.order.product is not None
            product = seat.order.product
            organization = seat.order.organization
        else:
            raise InvalidInvitationToken(invitation_token)

        organization_id = product.organization_id
        product_id = product.id

        await self.check_seat_feature_enabled(session, organization_id)

        # Validate seat has required data
        if not seat.customer_id:
            raise InvalidInvitationToken(invitation_token)

        # Get customer for session creation
        # Both paths use seat.customer_id, but it points to different customers:
        # - member_model: billing customer (purchaser)
        # - legacy: seat member's customer
        member_model_enabled = organization.feature_settings.get(
            "member_model_enabled", False
        )

        if member_model_enabled:
            # Validate member exists for member model
            if not seat.member_id:
                raise InvalidInvitationToken(invitation_token)
            # Load billing customer for session
            customer_repository = CustomerRepository.from_session(session)
            session_customer = await customer_repository.get_by_id(seat.customer_id)
            if not session_customer:
                raise InvalidInvitationToken(invitation_token)
        else:
            # Use seat's customer relationship for legacy model
            if not seat.customer:
                raise InvalidInvitationToken(invitation_token)
            session_customer = seat.customer

        # Claim the seat (unified)
        seat.status = SeatStatus.claimed
        seat.claimed_at = datetime.now(UTC)
        seat.invitation_token = None  # Single-use token

        await session.flush()

        await self._publish_seat_claimed_event(seat, product_id)
        await self._enqueue_benefit_grant(seat, product_id)

        if member_model_enabled:
            assert seat.member is not None
            session_token, _ = await member_session_service.create_member_session(
                session, seat.member
            )
        else:
            session_token, _ = await customer_session_service.create_customer_session(
                session, session_customer
            )

        log.info(
            "Seat claimed",
            seat_id=seat.id,
            customer_id=seat.customer_id,
            member_id=seat.member_id,
            subscription_id=seat.subscription_id,
            member_model_enabled=member_model_enabled,
            **(request_metadata or {}),
        )

        await self._send_seat_claimed_webhook(session, organization_id, seat)

        return seat, session_token

    async def revoke_seat(
        self,
        session: AsyncSession,
        seat: CustomerSeat,
    ) -> CustomerSeat:
        # Get product and organization from either subscription or order
        if seat.subscription_id and seat.subscription:
            organization_id = seat.subscription.product.organization_id
            product_id = seat.subscription.product_id
            organization = seat.subscription.product.organization
        elif seat.order_id and seat.order and seat.order.product_id:
            organization_id = seat.order.organization.id
            product_id = seat.order.product_id
            organization = seat.order.organization
        else:
            raise ValueError("Seat must have either subscription or order")

        await self.check_seat_feature_enabled(session, organization_id)

        # Check feature flag
        member_model_enabled = organization.feature_settings.get(
            "member_model_enabled", False
        )

        # Capture customer_id and member_id before clearing to avoid race condition
        original_customer_id = seat.customer_id
        original_member_id = seat.member_id

        # Revoke benefits from the customer before clearing the customer_id
        if original_customer_id:
            if seat.subscription_id:
                enqueue_job(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=original_customer_id,
                    product_id=product_id,
                    member_id=original_member_id,
                    subscription_id=seat.subscription_id,
                )
            else:
                enqueue_job(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=original_customer_id,
                    product_id=product_id,
                    member_id=original_member_id,
                    order_id=seat.order_id,
                )

        seat.status = SeatStatus.revoked
        seat.revoked_at = datetime.now(UTC)
        seat.invitation_token = None
        seat.customer_id = None
        seat.member_id = None
        seat.email = None

        await session.flush()

        log.info(
            "Seat revoked",
            seat_id=seat.id,
            subscription_id=seat.subscription_id,
            order_id=seat.order_id,
            member_model_enabled=member_model_enabled,
        )

        await webhook_service.send(
            session,
            organization,
            WebhookEventType.customer_seat_revoked,
            seat,
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

        # Get organization_id from either subscription or order
        if seat.subscription_id and seat.subscription:
            organization_id = seat.subscription.product.organization_id
        elif seat.order_id and seat.order:
            organization_id = seat.order.organization.id
        else:
            return None

        if isinstance(auth_subject.subject, Organization):
            if organization_id != auth_subject.subject.id:
                return None
        elif isinstance(auth_subject.subject, User):
            pass

        await self.check_seat_feature_enabled(session, organization_id)
        return seat

    async def resend_invitation(
        self,
        session: AsyncSession,
        seat: CustomerSeat,
    ) -> CustomerSeat:
        # Get product info and organization from either subscription or order
        if seat.subscription_id and seat.subscription and seat.subscription.product:
            organization_id = seat.subscription.product.organization_id
            organization = seat.subscription.product.organization
            product_name = seat.subscription.product.name
            billing_manager_email = seat.subscription.customer.email
        elif seat.order_id and seat.order and seat.order.product:
            organization_id = seat.order.product.organization_id
            organization = seat.order.organization
            product_name = seat.order.product.name
            billing_manager_email = seat.order.customer.email
        else:
            raise ValueError("Seat must have either subscription or order")

        await self.check_seat_feature_enabled(session, organization_id)

        if not seat.is_pending():
            raise SeatNotPending()

        if not seat.invitation_token:
            raise InvalidInvitationToken(seat.invitation_token or "")

        # Check feature flag
        member_model_enabled = organization.feature_settings.get(
            "member_model_enabled", False
        )

        # Determine the seat member email based on feature flag
        if member_model_enabled:
            # NEW PATH: Use seat.email
            if not seat.email:
                raise InvalidInvitationToken(seat.invitation_token or "")
            seat_member_email = seat.email
        else:
            # OLD PATH: Use seat.customer.email
            if not seat.customer:
                raise InvalidInvitationToken(seat.invitation_token or "")
            seat_member_email = seat.customer.email

        log.info(
            "Resending seat invitation",
            seat_id=seat.id,
            customer_id=seat.customer_id,
            subscription_id=seat.subscription_id,
            order_id=seat.order_id,
            member_model_enabled=member_model_enabled,
        )

        send_seat_invitation_email(
            customer_email=seat_member_email,
            seat=seat,
            organization=organization,
            product_name=product_name,
            billing_manager_email=billing_manager_email,
        )

        return seat

    async def get_seat_for_customer(
        self,
        session: AsyncReadSession,
        customer: Customer,
        seat_id: uuid.UUID,
    ) -> CustomerSeat | None:
        """Get a seat and verify it belongs to a subscription or order owned by the customer."""
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

    async def _find_or_create_customer(
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

    async def _get_or_create_member_for_seat(
        self,
        session: AsyncSession,
        billing_customer_id: uuid.UUID,
        organization_id: uuid.UUID,
        email: str,
    ) -> Member:
        """
        Get or create a Member for a seat assignment under the billing customer.

        This is used when member_model_enabled = True. Instead of creating a
        separate Customer for each seat member, we create Members under the
        billing customer (the purchaser).

        Args:
            session: Database session
            billing_customer_id: The customer who purchased (billing manager)
            organization_id: Organization ID
            email: Email of the seat member

        Returns:
            Member entity for the seat member
        """
        member_repository = MemberRepository.from_session(session)

        # Check if member already exists under this customer with this email
        existing_member = await member_repository.get_by_customer_id_and_email(
            billing_customer_id, email
        )
        if existing_member:
            return existing_member

        # Create new member under billing customer
        member = Member(
            customer_id=billing_customer_id,
            organization_id=organization_id,
            email=email,
            role=MemberRole.member,
        )
        session.add(member)
        await session.flush()

        log.info(
            "Created member for seat assignment",
            member_id=member.id,
            customer_id=billing_customer_id,
            organization_id=organization_id,
            email=email,
        )

        return member

    async def _resolve_member_model_target(
        self,
        session: AsyncSession,
        repository: CustomerSeatRepository,
        container: SeatContainer,
        billing_customer_id: uuid.UUID,
        organization_id: uuid.UUID,
        email: str | None,
        customer_id: uuid.UUID | None,
        external_customer_id: str | None,
    ) -> SeatAssignmentTarget:
        """Resolve seat assignment target when member_model_enabled=True.

        In the member model:
        - Only email is accepted (customer_id/external_customer_id rejected)
        - No Customer is created for the seat member
        - A Member is created under the billing customer
        - seat.customer_id = billing customer (purchaser)
        - seat.email = seat member's email
        """
        if not email or customer_id or external_customer_id:
            raise InvalidSeatAssignmentRequest(
                "Only email is supported when member_model_enabled is true. "
                "customer_id and external_customer_id are not allowed."
            )

        # Check if seat already assigned to this email
        existing_seat = await repository.get_by_container_and_email(container, email)
        if existing_seat and not existing_seat.is_revoked():
            raise SeatAlreadyAssigned(email)

        # Create Member under billing customer
        member = await self._get_or_create_member_for_seat(
            session, billing_customer_id, organization_id, email
        )

        return SeatAssignmentTarget(
            customer_id=billing_customer_id,
            member_id=member.id,
            email=email,
            seat_member_email=email,
        )

    async def _resolve_legacy_target(
        self,
        session: AsyncSession,
        repository: CustomerSeatRepository,
        container: SeatContainer,
        organization: Organization | None,
        organization_id: uuid.UUID,
        email: str | None,
        customer_id: uuid.UUID | None,
        external_customer_id: str | None,
    ) -> SeatAssignmentTarget:
        """Resolve seat assignment target when member_model_enabled=False.

        In the legacy model:
        - email, customer_id, or external_customer_id accepted (exactly one)
        - A Customer is created/found for the seat member
        - A Member may be created under that customer
        - seat.customer_id = seat member's customer
        - seat.email = None (email comes from customer relationship)
        """
        customer = await self._find_or_create_customer(
            session, organization_id, email, external_customer_id, customer_id
        )

        # Check if seat already assigned to this customer
        existing_seat = await repository.get_by_container_and_customer(
            container, customer.id
        )
        if existing_seat and not existing_seat.is_revoked():
            identifier = email or external_customer_id or str(customer_id)
            raise SeatAlreadyAssigned(identifier)

        # Optionally create member under this customer
        member = None
        if organization:
            member = await member_service.get_or_create_seat_member(
                session, customer, organization
            )

        return SeatAssignmentTarget(
            customer_id=customer.id,
            member_id=member.id if member else None,
            email=None,
            seat_member_email=customer.email,
        )


seat_service = SeatService()
