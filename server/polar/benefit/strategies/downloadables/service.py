from __future__ import annotations

from typing import Any, Unpack, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.customer_portal.service.downloadables import (
    downloadable as downloadable_service,
)
from polar.exceptions import ValidationError
from polar.file.repository import FileRepository
from polar.logging import Logger
from polar.models import Benefit, Customer, File, Member, Organization, User
from polar.models.benefit_grant import BenefitGrantScopeArgs

from ..base.service import BenefitPropertiesValidationError, BenefitServiceProtocol
from . import schemas
from .properties import (
    BenefitDownloadablesProperties,
    BenefitGrantDownloadablesProperties,
)

log: Logger = structlog.get_logger()


def get_active_file_ids(properties: BenefitDownloadablesProperties) -> list[UUID]:
    schema = schemas.BenefitDownloadablesProperties(**properties)
    return schemas.get_active_file_ids(schema)


class BenefitDownloadablesService(
    BenefitServiceProtocol[
        BenefitDownloadablesProperties, BenefitGrantDownloadablesProperties
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDownloadablesProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
        **scope: Unpack[BenefitGrantScopeArgs],
    ) -> BenefitGrantDownloadablesProperties:
        properties = self._get_properties(benefit)
        file_ids = get_active_file_ids(properties)

        # If we already granted this before, verify that the set of files
        # is the same. Otherwise revoke them and regrant them.
        if update and grant_properties:
            previous_file_ids = {UUID(f) for f in grant_properties.get("files", [])}
            if previous_file_ids != set(file_ids):
                await self.revoke(
                    benefit, customer, grant_properties, attempt=attempt, member=member
                )

        if not file_ids:
            return {}

        granted = []
        for file_id in file_ids:
            downloadable = await downloadable_service.grant_for_benefit_file(
                self.session,
                customer=customer,
                benefit_id=benefit.id,
                file_id=file_id,
                member_id=member.id if member else None,
            )
            if downloadable:
                granted.append(str(downloadable.file_id))

        return {
            "files": granted,
        }

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDownloadablesProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantDownloadablesProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDownloadablesProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantDownloadablesProperties:
        await downloadable_service.revoke_for_benefit(
            self.session,
            customer=customer,
            benefit_id=benefit.id,
            member_id=member.id if member else None,
        )
        return {}

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitDownloadablesProperties
    ) -> bool:
        properties = self._get_properties(benefit)
        new_file_ids = set(get_active_file_ids(properties))
        previous_file_ids = set(get_active_file_ids(previous_properties))
        return new_file_ids != previous_file_ids

    async def validate_properties(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        properties: dict[str, Any],
    ) -> BenefitDownloadablesProperties:
        file_ids = [UUID(file_id) for file_id in properties["files"]]
        repository = FileRepository.from_session(self.session)
        files = await repository.get_all(
            repository.get_base_statement().where(
                File.organization_id == organization.id,
                File.id.in_(file_ids),
            )
        )
        accessible_file_ids = {file.id for file in files}
        errors: list[ValidationError] = [
            {
                "type": "value_error",
                "msg": "File not found.",
                "loc": ("files", index),
                "input": str(file_id),
            }
            for index, file_id in enumerate(file_ids)
            if file_id not in accessible_file_ids
        ]
        if errors:
            raise BenefitPropertiesValidationError(errors)
        return cast(BenefitDownloadablesProperties, properties)
