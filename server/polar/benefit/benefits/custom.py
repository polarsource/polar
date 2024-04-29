from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.models import Organization, User
from polar.models.benefit import BenefitCustom, BenefitCustomProperties

from .base import BenefitServiceProtocol


class BenefitCustomService(
    BenefitServiceProtocol[BenefitCustom, BenefitCustomProperties]
):
    async def grant(
        self,
        benefit: BenefitCustom,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return {}

    async def revoke(
        self,
        benefit: BenefitCustom,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return {}

    async def requires_update(
        self,
        benefit: BenefitCustom,
        previous_properties: BenefitCustomProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitCustomProperties:
        return cast(BenefitCustomProperties, properties)
