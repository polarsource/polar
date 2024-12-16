from __future__ import annotations

from typing import Any, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.benefit import schemas as benefit_schemas
from polar.logging import Logger
from polar.models import Customer, Organization, User
from polar.models.benefit import BenefitDownloadables, BenefitDownloadablesProperties
from polar.models.benefit_grant import BenefitGrantDownloadablesProperties
from polar.user.service.downloadables import downloadable as downloadable_service

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


def get_active_file_ids(properties: BenefitDownloadablesProperties) -> list[UUID]:
    schema = benefit_schemas.BenefitDownloadablesProperties(**properties)
    return benefit_schemas.get_active_file_ids(schema)


class BenefitDownloadablesService(
    BenefitServiceProtocol[
        BenefitDownloadables,
        BenefitDownloadablesProperties,
        BenefitGrantDownloadablesProperties,
    ]
):
    async def grant(
        self,
        benefit: BenefitDownloadables,
        customer: Customer,
        grant_properties: BenefitGrantDownloadablesProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantDownloadablesProperties:
        file_ids = get_active_file_ids(benefit.properties)
        if not file_ids:
            return {}

        granted = []
        for file_id in file_ids:
            downloadable = await downloadable_service.grant_for_benefit_file(
                self.session,
                customer=customer,
                benefit_id=benefit.id,
                file_id=file_id,
            )
            if downloadable:
                granted.append(str(downloadable.file_id))

        return {
            "files": granted,
        }

    async def revoke(
        self,
        benefit: BenefitDownloadables,
        customer: Customer,
        grant_properties: BenefitGrantDownloadablesProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantDownloadablesProperties:
        await downloadable_service.revoke_for_benefit(
            self.session,
            customer=customer,
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
