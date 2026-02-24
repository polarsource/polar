from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.models import Benefit, Customer, Member, Organization, User

from ..base.service import BenefitServiceProtocol
from .properties import BenefitFeatureFlagProperties, BenefitGrantFeatureFlagProperties


class BenefitFeatureFlagService(
    BenefitServiceProtocol[
        BenefitFeatureFlagProperties, BenefitGrantFeatureFlagProperties
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantFeatureFlagProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantFeatureFlagProperties:
        return {}

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantFeatureFlagProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantFeatureFlagProperties:
        return {}

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantFeatureFlagProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantFeatureFlagProperties:
        return {}

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitFeatureFlagProperties
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitFeatureFlagProperties:
        return cast(BenefitFeatureFlagProperties, properties)
