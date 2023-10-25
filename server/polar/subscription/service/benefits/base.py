from typing import Protocol

from polar.exceptions import PolarError
from polar.models import SubscriptionBenefit
from polar.postgres import AsyncSession


class SubscriptionBenefitServiceError(PolarError):
    ...


class SubscriptionBenefitGrantError(SubscriptionBenefitServiceError):
    ...


class SubscriptionBenefitRevokeError(SubscriptionBenefitServiceError):
    ...


class SubscriptionBenefitServiceProtocol(Protocol):
    session: AsyncSession

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def grant(self, benefit: SubscriptionBenefit) -> None:
        ...

    async def revoke(self, benefit: SubscriptionBenefit) -> None:
        ...
