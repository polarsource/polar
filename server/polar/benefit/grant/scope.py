from uuid import UUID

import structlog
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.member.repository import MemberRepository
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


async def resolve_member(
    session: AsyncSession,
    customer_id: UUID,
    organization: Organization,
    member_id: UUID | None,
    is_seat_based: bool,
) -> Member | None:
    member_model_enabled = organization.feature_settings.get(
        "member_model_enabled", False
    )

    if not member_model_enabled:
        return None

    member_repository = MemberRepository.from_session(session)

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

    member = await member_repository.get_owner_by_customer_id(session, customer_id)
    if member is None:
        log.error(
            "Owner member not found for benefit grant",
            customer_id=str(customer_id),
            organization_id=str(organization.id),
        )
        raise CustomerDoesntHaveOwnerMember(customer_id)

    return member
