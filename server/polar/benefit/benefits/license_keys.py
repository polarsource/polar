from __future__ import annotations

from typing import Any, cast

import structlog

from polar.auth.models import AuthSubject
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitLicenseKeys, BenefitLicenseKeysProperties
from polar.user.service.license_key import license_key as license_key_service

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


class BenefitLicenseKeysService(
    BenefitServiceProtocol[BenefitLicenseKeys, BenefitLicenseKeysProperties]
):
    async def grant(
        self,
        benefit: BenefitLicenseKeys,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        key = await license_key_service.user_grant(
            self.session,
            user=user,
            benefit=benefit,
        )
        return {
            "license_key_id": key.id,
        }

    async def revoke(
        self,
        benefit: BenefitLicenseKeys,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        revoked = await license_key_service.user_revoke(
            self.session,
            user=user,
            benefit=benefit,
        )
        return {}

    async def requires_update(
        self,
        benefit: BenefitLicenseKeys,
        previous_properties: BenefitLicenseKeysProperties,
    ) -> bool:
        c = benefit.properties
        pre = previous_properties
        ret = (
            c.get("expires", None) != pre.get("expires", None)
            or c.get("activation_limit", None) != pre.get("activation_limit", None)
            or c.get("ttl", None) != pre.get("ttl", None)
            or c.get("timeframe", None) != pre.get("timeframe", None)
        )
        return ret

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitLicenseKeysProperties:
        return cast(BenefitLicenseKeysProperties, properties)
