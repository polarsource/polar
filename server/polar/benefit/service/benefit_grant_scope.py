from polar.exceptions import PolarError
from polar.models.benefit_grant import BenefitGrantScope, BenefitGrantScopeArgs
from polar.postgres import AsyncSession


class BenefitGrantScopeError(PolarError): ...


class InvalidScopeError(BenefitGrantScopeError):
    def __init__(self, scope: BenefitGrantScopeArgs) -> None:
        self.scope = scope
        message = "The provided scope is invalid."
        super().__init__(message, 500)


async def resolve_scope(
    session: AsyncSession, scope: BenefitGrantScopeArgs
) -> BenefitGrantScope:
    # Avoids a circular import :(
    from polar.sale.service import sale as sale_service
    from polar.subscription.service import (
        subscription as subscription_service,
    )

    resolved_scope: BenefitGrantScope = {}
    if subscription_id := scope.get("subscription_id"):
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise InvalidScopeError(scope)
        resolved_scope["subscription"] = subscription
    if sale_id := scope.get("sale_id"):
        sale = await sale_service.get(session, sale_id)
        if sale is None:
            raise InvalidScopeError(scope)
        resolved_scope["sale"] = sale
    return resolved_scope


def scope_to_args(scope: BenefitGrantScope) -> BenefitGrantScopeArgs:
    args: BenefitGrantScopeArgs = {}
    if subscription := scope.get("subscription"):
        args["subscription_id"] = subscription.id
    if sale := scope.get("sale"):
        args["sale_id"] = sale.id
    return args
