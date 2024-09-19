from __future__ import annotations

from typing import Any, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.license_key.service import license_key as license_key_service
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitLicenseKeys, BenefitLicenseKeysProperties
from polar.models.benefit_grant import BenefitGrantLicenseKeysProperties

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


class BenefitLicenseKeysService(
    BenefitServiceProtocol[
        BenefitLicenseKeys,
        BenefitLicenseKeysProperties,
        BenefitGrantLicenseKeysProperties,
    ]
):
    async def grant(
        self,
        benefit: BenefitLicenseKeys,
        user: User,
        grant_properties: BenefitGrantLicenseKeysProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantLicenseKeysProperties:
        current_lk_id = None
        if update:
            current_lk_id = UUID(grant_properties["license_key_id"])

        key = await license_key_service.user_grant(
            self.session,
            user=user,
            benefit=benefit,
            license_key_id=current_lk_id,
        )
        return {
            "license_key_id": str(key.id),
            "display_key": key.display_key,
        }

    async def revoke(
        self,
        benefit: BenefitLicenseKeys,
        user: User,
        grant_properties: BenefitGrantLicenseKeysProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantLicenseKeysProperties:
        license_key_id = grant_properties.get("license_key_id")
        if not license_key_id:
            log.info(
                "license_key.revoke.skip",
                user_id=user.id,
                benefit_id=benefit.id,
                message="No license key to revoke",
            )
            return grant_properties

        await license_key_service.user_revoke(
            self.session,
            user=user,
            benefit=benefit,
            license_key_id=UUID(license_key_id),
        )
        # Keep grant properties for reference
        return grant_properties

    async def requires_update(
        self,
        benefit: BenefitLicenseKeys,
        previous_properties: BenefitLicenseKeysProperties,
    ) -> bool:
        c = benefit.properties
        pre = previous_properties

        diff_expires = c.get("expires", None) != pre.get("expires", None)
        diff_activations = c.get("activations", None) != pre.get("activations", None)
        diff_usage = c.get("limit_usage", None) != pre.get("limit_usage", None)
        return diff_expires or diff_activations or diff_usage

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitLicenseKeysProperties:
        return cast(BenefitLicenseKeysProperties, properties)
