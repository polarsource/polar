from typing import Generic, Protocol, TypeVar

from polar.exceptions import PolarError
from polar.models import SubscriptionBenefit
from polar.postgres import AsyncSession


class SubscriptionBenefitServiceError(PolarError):
    ...


class SubscriptionBenefitGrantError(SubscriptionBenefitServiceError):
    ...


class SubscriptionBenefitRevokeError(SubscriptionBenefitServiceError):
    ...


SB = TypeVar("SB", bound=SubscriptionBenefit, contravariant=True)


class SubscriptionBenefitServiceProtocol(Protocol[SB]):
    session: AsyncSession

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def grant(self, benefit: SB) -> None:
        ...

    async def revoke(self, benefit: SB) -> None:
        ...
