from __future__ import annotations

from typing import Any, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.license_key.service import license_key as license_key_service
from polar.logging import Logger
from polar.models import Benefit, Customer, Member, Organization, User

from ..base.service import BenefitServiceProtocol
from .properties import BenefitGrantLicenseKeysProperties, BenefitLicenseKeysProperties

log: Logger = structlog.get_logger()


class BenefitLicenseKeysService(
    BenefitServiceProtocol[
        BenefitLicenseKeysProperties, BenefitGrantLicenseKeysProperties
    ]
):
    should_revoke_individually = True

    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLicenseKeysProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantLicenseKeysProperties:
        current_lk_id = None
        if update and "license_key_id" in grant_properties:
            current_lk_id = UUID(grant_properties["license_key_id"])

        user_provided_key: str | None = None
        if not update and "user_provided_key" in grant_properties:
            user_provided_key = grant_properties["user_provided_key"]

        license_key = await license_key_service.customer_grant(
            self.session,
            customer=customer,
            benefit=benefit,
            license_key_id=current_lk_id,
            key=user_provided_key,
        )
        return {
            "license_key_id": str(license_key.id),
            "display_key": license_key.display_key,
        }

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLicenseKeysProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantLicenseKeysProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLicenseKeysProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantLicenseKeysProperties:
        license_key_id = grant_properties.get("license_key_id")
        if not license_key_id:
            log.info(
                "license_key.revoke.skip",
                customer_id=customer.id,
                benefit_id=benefit.id,
                message="No license key to revoke",
            )
            return grant_properties

        await license_key_service.customer_revoke(
            self.session,
            customer=customer,
            benefit=benefit,
            license_key_id=UUID(license_key_id),
        )
        # Keep grant properties for reference
        return grant_properties

    async def requires_update(
        self,
        benefit: Benefit,
        previous_properties: BenefitLicenseKeysProperties,
    ) -> bool:
        c = self._get_properties(benefit)
        pre = previous_properties

        diff_expires = c.get("expires", None) != pre.get("expires", None)
        diff_activations = c.get("activations", None) != pre.get("activations", None)
        diff_usage = c.get("limit_usage", None) != pre.get("limit_usage", None)
        return diff_expires or diff_activations or diff_usage

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitLicenseKeysProperties:
        return cast(BenefitLicenseKeysProperties, properties)
