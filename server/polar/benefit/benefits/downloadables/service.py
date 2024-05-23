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

from ..base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = ()
precondition_error_body_template = """"""


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
        return await self.iterate_files(
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
        return await self.iterate_files(
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
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitDownloadablesProperties:
        return cast(BenefitDownloadablesProperties, properties)

    async def iterate_files(
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
        file_ids = benefit.properties.get("files", [])
        if not file_ids:
            return ret

        if action not in ["grant", "revoke"]:
            # TODO: Handle error
            return ret

        for file_id in file_ids:
            permission = None
            if action == "grant":
                permission = await self.grant_downloadable(
                    benefit=benefit,
                    user=user,
                    file_id=file_id,
                    update=update,
                    attempt=attempt,
                )
            elif action == "revoke":
                permission = await self.revoke_downloadable(
                    benefit=benefit,
                    user=user,
                    file_id=file_id,
                    attempt=attempt,
                )

            if not permission:
                # TODO: Handle error
                continue

            ret["files"].append(
                dict(
                    file_id=file_id,
                    downloadable_id=str(permission.id),
                    status=permission.status,
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
        # TODO: Check if active?
        file = await file_service.get(self.session, file_id)
        if not file:
            # TODO: How to deal with errors here?
            return None

        create_schema = DownloadableCreate(
            file_id=file.id,
            user_id=user.id,
            benefit_id=benefit.id,
            status=DownloadableStatus.granted,
        )
        return await downloadable_service.create_or_update(self.session, create_schema)

    async def revoke_downloadable(
        self,
        benefit: BenefitDownloadables,
        user: User,
        file_id: UUID,
        *,
        attempt: int = 1,
    ) -> Downloadable | None:
        # TODO: Check if active?
        file = await file_service.get(self.session, file_id)
        if not file:
            # TODO: How to deal with errors here?
            return None

        create_schema = DownloadableCreate(
            file_id=file.id,
            user_id=user.id,
            benefit_id=benefit.id,
            status=DownloadableStatus.revoked,
        )
        return await downloadable_service.create_or_update(self.session, create_schema)
