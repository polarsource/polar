from polar.exceptions import PolarError
from polar.models.benefit_grant import BenefitGrantScope, BenefitGrantScopeArgs
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository


class BenefitGrantScopeError(PolarError): ...


class InvalidScopeError(BenefitGrantScopeError):
    def __init__(self, scope: BenefitGrantScopeArgs) -> None:
        self.scope = scope
        message = "The provided scope is invalid."
        super().__init__(message, 500)


async def resolve_scope(
    session: AsyncSession, scope: BenefitGrantScopeArgs
) -> BenefitGrantScope:
    resolved_scope: BenefitGrantScope = {}
    if subscription_id := scope.get("subscription_id"):
        subscription_repository = SubscriptionRepository.from_session(session)
        subscription = await subscription_repository.get_by_id(subscription_id)
        if subscription is None:
            raise InvalidScopeError(scope)
        resolved_scope["subscription"] = subscription
    if order_id := scope.get("order_id"):
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(order_id)
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
