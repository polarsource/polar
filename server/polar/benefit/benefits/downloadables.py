from __future__ import annotations

from typing import Any, Literal, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.downloadable.schemas import DownloadableCreate
from polar.downloadable.service import downloadable as downloadable_service
from polar.file.service import file as file_service
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitDownloadables, BenefitDownloadablesProperties
from polar.models.downloadable import Downloadable, DownloadableStatus

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


def get_ids_from_files_properties(
    properties: BenefitDownloadablesProperties,
) -> list[UUID]:
    ids = []
    files = properties.get("files", [])
    for file_id in files:
        if not isinstance(file_id, UUID):
            file_id = UUID(file_id)
        ids.append(file_id)
    return ids


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
        return await self.update_file_grants(
            benefit=benefit,
            user=user,
            grant_properties=grant_properties,
            action="grant",
            update=update,
            attempt=attempt,
        )

    async def revoke(
        self,
        benefit: BenefitDownloadables,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return await self.update_file_grants(
            benefit=benefit,
            user=user,
            grant_properties=grant_properties,
            action="revoke",
            attempt=attempt,
        )

    async def requires_update(
        self,
        benefit: BenefitDownloadables,
        previous_properties: BenefitDownloadablesProperties,
    ) -> bool:
        new_file_ids = set(get_ids_from_files_properties(benefit.properties))
        previous_file_ids = set(get_ids_from_files_properties(previous_properties))
        return new_file_ids != previous_file_ids

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitDownloadablesProperties:
        return cast(BenefitDownloadablesProperties, properties)

    async def update_file_grants(
        self,
        benefit: BenefitDownloadables,
        user: User,
        grant_properties: dict[str, Any],
        *,
        action: Literal["grant"] | Literal["revoke"],
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ret: dict[str, Any] = dict(files=[])
        file_ids = get_ids_from_files_properties(benefit.properties)

        # First revoke all existing grants for files not included in
        # the current benefit state, i.e benefit.properties
        await downloadable_service.revoke_user_grants(
            self.session,
            user=user,
            benefit_id=benefit.id,
            unless_file_id_in=file_ids,
        )
        log.info(
            "benefit.downloadables.revoke_user_grants",
            user_id=user.id,
            benefit_id=benefit.id,
            unless=file_ids,
        )

        if not file_ids:
            return ret

        for file_id in file_ids:
            downloadable = None
            if action == "grant":
                downloadable = await self.grant_downloadable(
                    benefit=benefit,
                    user=user,
                    file_id=file_id,
                    update=update,
                    attempt=attempt,
                )
            elif action == "revoke":
                downloadable = await self.revoke_downloadable(
                    benefit=benefit,
                    user=user,
                    file_id=file_id,
                    attempt=attempt,
                )

            if not downloadable:
                continue

            ret["files"].append(
                dict(
                    file_id=str(file_id),
                    downloadable_id=str(downloadable.id),
                    status=downloadable.status,
                )
            )

        return ret

    async def grant_downloadable(
        self,
        benefit: BenefitDownloadables,
        user: User,
        file_id: UUID,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> Downloadable | None:
        file = await file_service.get(self.session, file_id)
        if not file:
            log.info(
                "benefit.downloadables.file_not_found",
                action="grant",
                file_id=file_id,
                user_id=user.id,
                benefit_id=benefit.id,
            )
            return None

        create_schema = DownloadableCreate(
            file_id=file.id,
            user_id=user.id,
            benefit_id=benefit.id,
            status=DownloadableStatus.granted,
        )
        res = await downloadable_service.create_or_update(self.session, create_schema)
        log.info(
            "benefit.downloadables.granted",
            file_id=file_id,
            user_id=user.id,
            downloadables_id=res.id,
            benefit_id=benefit.id,
        )
        return res

    async def revoke_downloadable(
        self,
        benefit: BenefitDownloadables,
        user: User,
        file_id: UUID,
        *,
        attempt: int = 1,
    ) -> Downloadable | None:
        file = await file_service.get(self.session, file_id)
        if not file:
            log.info(
                "benefit.downloadables.file_not_found",
                action="revoke",
                file_id=file_id,
                user_id=user.id,
                benefit_id=benefit.id,
            )
            return None

        create_schema = DownloadableCreate(
            file_id=file.id,
            user_id=user.id,
            benefit_id=benefit.id,
            status=DownloadableStatus.revoked,
        )
        res = await downloadable_service.create_or_update(self.session, create_schema)
        log.info(
            "benefit.downloadables.revoked",
            file_id=file_id,
            user_id=user.id,
            downloadables_id=res.id,
            benefit_id=benefit.id,
        )
        return res
