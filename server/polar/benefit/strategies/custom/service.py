from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.models import Benefit, Customer, Member, Organization, User

from ..base.service import BenefitServiceProtocol
from .properties import BenefitCustomProperties, BenefitGrantCustomProperties


class BenefitCustomService(
    BenefitServiceProtocol[BenefitCustomProperties, BenefitGrantCustomProperties]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCustomProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCustomProperties:
        return {}

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCustomProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCustomProperties:
        return {}

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCustomProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCustomProperties:
        return {}

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitCustomProperties
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitCustomProperties:
        return cast(BenefitCustomProperties, properties)
