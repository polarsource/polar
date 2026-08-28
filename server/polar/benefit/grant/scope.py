from uuid import UUID

import structlog
from sqlalchemy.orm import joinedload

from polar.customer.repository import CustomerRepository
from polar.customer_seat.repository import CustomerSeatRepository
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.logging import Logger
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Member, Organization
from polar.models.benefit_grant import BenefitGrantScope, BenefitGrantScopeArgs
from polar.models.order import Order
from polar.models.subscription import Subscription
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository

log: Logger = structlog.get_logger()


class BenefitGrantScopeError(PolarError): ...


class InvalidScopeError(BenefitGrantScopeError):
    def __init__(self, scope: BenefitGrantScopeArgs) -> None:
        self.scope = scope
        message = "The provided scope is invalid."
        super().__init__(message, 500)


class MemberIdRequired(BenefitGrantScopeError):
    def __init__(self) -> None:
        message = (
            "member_id is required for seat-based products "
            "when member_model is enabled."
        )
        super().__init__(message, 400)


class MemberNotFound(BenefitGrantScopeError):
    def __init__(self, member_id: UUID) -> None:
        self.member_id = member_id
        message = f"Member with id {member_id} does not exist."
        super().__init__(message, 400)


class CustomerDoesntHaveOwnerMember(BenefitGrantScopeError):
    def __init__(self, customer_id: UUID) -> None:
        self.customer_id = customer_id
        message = f"Customer with id {customer_id} does not have an owner member."
        super().__init__(message, 400)


async def resolve_scope(
    session: AsyncSession, scope: BenefitGrantScopeArgs
) -> BenefitGrantScope:
    resolved_scope: BenefitGrantScope = {}
    if subscription_id := scope.get("subscription_id"):
        subscription_repository = SubscriptionRepository.from_session(session)
        subscription = await subscription_repository.get_by_id(
            subscription_id,
            options=(joinedload(Subscription.product),),
        )
        if subscription is None:
            raise InvalidScopeError(scope)
        resolved_scope["subscription"] = subscription
    if order_id := scope.get("order_id"):
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            order_id,
            options=(joinedload(Order.product),),
        )
        if order is None:
            raise InvalidScopeError(scope)
        resolved_scope["order"] = order
    return resolved_scope


def scope_to_args(scope: BenefitGrantScope) -> BenefitGrantScopeArgs:
    args: BenefitGrantScopeArgs = {}
    if subscription := scope.get("subscription"):
        args["subscription_id"] = subscription.id
    if order := scope.get("order"):
        args["order_id"] = order.id
    return args


async def _resolve_or_create_owner_member(
    session: AsyncSession,
    customer_id: UUID,
    organization: Organization,
    *,
    include_deleted: bool = False,
) -> Member | None:
    """Return the customer's owner member, creating it if it doesn't exist yet.

    Returns None when the customer no longer exists.
    """
    member_repository = MemberRepository.from_session(session)
    member = await member_repository.get_owner_by_customer_id(
        customer_id, include_deleted=include_deleted
    )
    if member is not None:
        return member

    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(customer_id)
    if customer is None:
        return None

    return await member_service.create_owner_member(session, customer, organization)


async def resolve_member(
    session: AsyncSession,
    customer_id: UUID,
    organization: Organization,
    member_id: UUID | None,
    is_seat_based: bool,
    *,
    subscription_id: UUID | None = None,
    order_id: UUID | None = None,
    include_deleted: bool = False,
) -> Member | None:
    member_model_enabled = organization.feature_settings.get(
        "member_model_enabled", False
    )

    member_repository = MemberRepository.from_session(session)

    if not member_model_enabled:
        if member_id is not None:
            member = await member_repository.get_by_id(member_id)
            return member  # may be None if member was deleted
        if is_seat_based:
            # A seat holder's grant belongs to the member on their seat, which
            # lives under the buyer rather than under the holder.
            seat_member_id = await CustomerSeatRepository.from_session(
                session
            ).get_active_seat_member_id(
                customer_id, subscription_id=subscription_id, order_id=order_id
            )
            if seat_member_id is not None:
                return await member_repository.get_by_id(seat_member_id)
        # Populate the member before the flag flips, so grants don't pile up
        # needing a backfill. Best effort: a customer we can't build an owner
        # member for still gets its grant.
        try:
            return await _resolve_or_create_owner_member(
                session, customer_id, organization, include_deleted=include_deleted
            )
        except PolarRequestValidationError:
            log.warning(
                "Could not link benefit grant to an owner member",
                customer_id=str(customer_id),
                organization_id=str(organization.id),
            )
            return None

    if member_id is not None:
        member = await member_repository.get_by_id(member_id)
        if member is None:
            log.error(
                "Member not found for seat-based benefit grant",
                member_id=str(member_id),
                customer_id=str(customer_id),
                organization_id=str(organization.id),
            )
            raise MemberNotFound(member_id)
        return member

    if is_seat_based:
        raise MemberIdRequired()

    member = await _resolve_or_create_owner_member(
        session, customer_id, organization, include_deleted=include_deleted
    )
    if member is None:
        log.error(
            "Owner member not found for benefit grant",
            customer_id=str(customer_id),
            organization_id=str(organization.id),
        )
        raise CustomerDoesntHaveOwnerMember(customer_id)

    return member
