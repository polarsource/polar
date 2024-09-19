from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.models import Organization, User
from polar.models.benefit import BenefitAds, BenefitAdsProperties
from polar.models.benefit_grant import BenefitGrantAdsProperties

from .base import BenefitServiceProtocol


class BenefitAdsService(
    BenefitServiceProtocol[BenefitAds, BenefitAdsProperties, BenefitGrantAdsProperties]
):
    async def grant(
        self,
        benefit: BenefitAds,
        user: User,
        grant_properties: BenefitGrantAdsProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantAdsProperties:
        # `grant_properties` stores the associated campaign ID, but it's
        # set by the user with a dedicated endpoint.
        # Make sure then to not overwrite it.
        return grant_properties

    async def revoke(
        self,
        benefit: BenefitAds,
        user: User,
        grant_properties: BenefitGrantAdsProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantAdsProperties:
        # `grant_properties` stores the associated campaign ID, but it's
        # set by the user with a dedicated endpoint.
        # Make sure then to not overwrite it.
        return grant_properties

    async def requires_update(
        self,
        benefit: BenefitAds,
        previous_properties: BenefitAdsProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitAdsProperties:
        return cast(BenefitAdsProperties, properties)
