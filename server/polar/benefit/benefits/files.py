from __future__ import annotations

from typing import Any, Literal, cast
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.file.schemas import FilePermissionCreate
from polar.file.service import file as file_service
from polar.file.service import file_permission as file_permission_service
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitFiles, BenefitFilesProperties
from polar.models.file_permission import FilePermission, FilePermissionStatus

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = ()
precondition_error_body_template = """"""


class BenefitFilesService(BenefitServiceProtocol[BenefitFiles, BenefitFilesProperties]):
    async def grant(
        self,
        benefit: BenefitFiles,
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
        benefit: BenefitFiles,
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
        benefit: BenefitFiles,
        previous_properties: BenefitFilesProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitFilesProperties:
        return cast(BenefitFilesProperties, properties)

    async def iterate_files(
        self,
        benefit: BenefitFiles,
        user: User,
        grant_properties: dict[str, Any],
        *,
        action: Literal["grant"] | Literal["revoke"],
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ret = dict(files=[])
        file_ids = benefit.properties.get("files", [])
        if not file_ids:
            return ret

        if action not in ["grant", "revoke"]:
            # TODO: Handle error
            return ret

        for file_id in file_ids:
            permission = None
            if action == "grant":
                permission = await self.grant_file_permission(
                    benefit=benefit,
                    user=user,
                    file_id=file_id,
                    update=update,
                    attempt=attempt,
                )
            elif action == "revoke":
                permission = await self.revoke_file_permission(
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
                    file_permission_id=str(permission.id),
                    status=permission.status,
                )
            )

        return ret

    async def grant_file_permission(
        self,
        benefit: BenefitFiles,
        user: User,
        file_id: UUID,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> FilePermission | None:
        # TODO: Check if active?
        file = await file_service.get(self.session, file_id)
        if not file:
            # TODO: How to deal with errors here?
            return {}

        create_schema = FilePermissionCreate(
            file_id=file.id,
            user_id=user.id,
            status=FilePermissionStatus.granted,
        )
        return await file_permission_service.create_or_update(
            self.session, create_schema
        )

    async def revoke_file_permission(
        self,
        benefit: BenefitFiles,
        user: User,
        file_id: UUID,
        *,
        attempt: int = 1,
    ) -> FilePermission | None:
        # TODO: Check if active?
        file = await file_service.get(self.session, file_id)
        if not file:
            # TODO: How to deal with errors here?
            return {}

        create_schema = FilePermissionCreate(
            file_id=file.id,
            user_id=user.id,
            status=FilePermissionStatus.revoke,
        )
        return await file_permission_service.create_or_update(
            self.session, create_schema
        )
