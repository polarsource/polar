from __future__ import annotations

from typing import Any, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.benefit import schemas as benefit_schemas
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitDownloadables, BenefitDownloadablesProperties
from polar.user.service.downloadables import downloadable as downloadable_service

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


def get_active_file_ids(properties: BenefitDownloadablesProperties) -> list[UUID]:
    schema = benefit_schemas.BenefitDownloadablesProperties(**properties)
    return benefit_schemas.get_active_file_ids(schema)


class BenefitDownloadablesService(
    BenefitServiceProtocol[BenefitDownloadables, BenefitDownloadablesProperties]
):
    async def grant(
        self,
        benefit: BenefitDownloadables,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ret: dict[str, Any] = dict(files=[])
        file_ids = get_active_file_ids(benefit.properties)
        if not file_ids:
            return ret

        for file_id in file_ids:
            downloadable = await downloadable_service.grant_for_benefit_file(
                self.session,
                user=user,
                benefit_id=benefit.id,
                file_id=file_id,
            )

            if not downloadable:
                continue

            ret["files"].append(str(downloadable.file_id))

        return ret

    async def revoke(
        self,
        benefit: BenefitDownloadables,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        await downloadable_service.revoke_for_benefit(
            self.session,
            user=user,
            benefit_id=benefit.id,
        )
        return {}

    async def requires_update(
        self,
        benefit: BenefitDownloadables,
        previous_properties: BenefitDownloadablesProperties,
    ) -> bool:
        new_file_ids = set(get_active_file_ids(benefit.properties))
        previous_file_ids = set(get_active_file_ids(previous_properties))
        return new_file_ids != previous_file_ids

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitDownloadablesProperties:
        return cast(BenefitDownloadablesProperties, properties)
