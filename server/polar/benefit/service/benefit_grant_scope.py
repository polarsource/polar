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
    from polar.subscription.service import (
        subscription as subscription_service,
    )

    resolved_scope: BenefitGrantScope = {}
    if subscription_id := scope.get("subscription_id"):
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise InvalidScopeError(scope)
        resolved_scope["subscription"] = subscription
    return resolved_scope
