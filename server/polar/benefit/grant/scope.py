from uuid import UUID

import structlog
from sqlalchemy.orm import joinedload

from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.logging import Logger
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Member, Organization
from polar.models.benefit_grant import (
    BenefitGrantScope,
    BenefitGrantScopeArgs,
    BenefitGrantSelector,
    BenefitGrantSelectorArgs,
)
from polar.models.order import Order
from polar.models.subscription import Subscription
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository

from .repository import BenefitGrantRepository

log: Logger = structlog.get_logger()


class BenefitGrantScopeError(PolarError): ...


class InvalidScopeError(BenefitGrantScopeError):
    def __init__(self, scope: BenefitGrantScopeArgs | BenefitGrantSelectorArgs) -> None:
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
    if not resolved_scope:
        raise InvalidScopeError(scope)
    return resolved_scope


async def resolve_selector(
    session: AsyncSession,
    selector: BenefitGrantSelectorArgs,
    *,
    customer_id: UUID,
    benefit_id: UUID,
) -> BenefitGrantSelector:
    if "benefit_grant_id" in selector:
        if len(selector) != 1:
            raise InvalidScopeError(selector)
        repository = BenefitGrantRepository.from_session(session)
        grant = await repository.get_for_fulfillment(
            selector["benefit_grant_id"], customer_id=customer_id, benefit_id=benefit_id
        )
        if grant is None:
            raise InvalidScopeError(selector)
        return {"grant": grant}
    scope = await resolve_scope(session, selector)
    return {**scope}


def scope_to_args(scope: BenefitGrantScope) -> BenefitGrantScopeArgs:
    args: BenefitGrantScopeArgs = {}
    if subscription := scope.get("subscription"):
        args["subscription_id"] = subscription.id
    if order := scope.get("order"):
        args["order_id"] = order.id
    return args


async def _resolve_owner_member(
    session: AsyncSession,
    customer_id: UUID,
    organization: Organization,
    *,
    include_deleted: bool,
) -> Member | None:
    member_repository = MemberRepository.from_session(session)
    member = await member_repository.get_owner_by_customer_id(
        customer_id, include_deleted=include_deleted
    )
    if member is not None:
        return member

    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(customer_id)
    if customer is None or customer.email is None:
        return None
    return await member_service.create_owner_member(session, customer, organization)


async def resolve_member(
    session: AsyncSession,
    customer_id: UUID,
    organization: Organization,
    member_id: UUID | None,
    selector: BenefitGrantSelector,
    *,
    include_deleted: bool = False,
) -> Member | None:
    if "grant" in selector:
        return selector["grant"].member

    if member_id is not None:
        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_id(
            member_id, include_deleted=include_deleted
        )
        if member is None:
            log.error(
                "Member not found for seat-based benefit grant",
                member_id=str(member_id),
                customer_id=str(customer_id),
                organization_id=str(organization.id),
            )
            raise MemberNotFound(member_id)
        return member

    purchase = selector.get("subscription") or selector.get("order")
    product = purchase.product if purchase is not None else None
    if product is not None and product.has_seat_based_price:
        raise MemberIdRequired()

    member = await _resolve_owner_member(
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
