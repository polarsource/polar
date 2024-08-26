from __future__ import annotations

from typing import Any, cast

import structlog

from polar.auth.models import AuthSubject
from polar.license_key.service import license_key as license_key_service
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitLicenseKeys, BenefitLicenseKeysProperties

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
        current_lk_id = grant_properties.get("license_key_id", None)
        if update and not current_lk_id:
            # TODO: Fix me
            raise RuntimeError()

        key = await license_key_service.user_grant(
            self.session,
            user=user,
            benefit=benefit,
            license_key_id=current_lk_id,
        )
        return dict(
            license_key_id=str(key.id),
            display_key=key.display_key,
        )

    async def revoke(
        self,
        benefit: BenefitLicenseKeys,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        license_key_id = grant_properties["license_key_id"]
        await license_key_service.user_revoke(
            self.session,
            user=user,
            benefit=benefit,
            license_key_id=license_key_id,
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
