import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import structlog
from py_svg_hush import filter_svg

from polar.auth.models import Agent, AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import BadRequest
from polar.integrations.aws.s3 import S3Service
from polar.integrations.aws.s3.schemas import S3File
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import Organization, ProductMedia, User
from polar.models.file import File, FileServiceTypes, ProductMediaFile
from polar.notifications.notification import (
    MaintainerFileFlaggedMaliciousNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.postgres import AsyncReadSession, AsyncSession, sql

from .repository import FileRepository
from .s3 import S3_SERVICES
from .schemas import (
    FileCreate,
    FileDownload,
    FilePatch,
    FileUpload,
    FileUploadCompleted,
)

log = structlog.get_logger()

SVG_MIME_TYPE = "image/svg+xml"
SVG_DATA_URL_MIME_TYPES = {"image": ["jpeg", "png", "gif"]}
SVG_SANITIZED_SERVICES = {
    FileServiceTypes.product_media,
    FileServiceTypes.organization_avatar,
}


class FileService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        ids: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[File], int]:
        repository = FileRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_read
        )

        statement = repository.get_statement_by_org_ids(org_ids).where(
            File.is_uploaded,
            File.service != FileServiceTypes.support_case_attachment,
        )

        if organization_id is not None:
            statement = statement.where(File.organization_id.in_(organization_id))

        if ids is not None:
            statement = statement.where(File.id.in_(ids))

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        id: uuid.UUID,
    ) -> File | None:
        repository = FileRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_read
        )
        statement = repository.get_statement_by_org_ids(org_ids).where(File.id == id)
        return await repository.get_one_or_none(statement)

    async def patch(
        self,
        session: AsyncSession,
        *,
        file: File,
        patches: FilePatch,
    ) -> File:
        changes = False
        if patches.name:
            file.name = patches.name
            changes = True

        if patches.version:
            file.version = patches.version
            changes = True

        if not changes:
            return file

        session.add(file)
        await session.flush()
        return file

    async def generate_presigned_upload(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        create_schema: FileCreate,
    ) -> FileUpload:
        s3_service = S3_SERVICES[create_schema.service]
        upload = s3_service.create_multipart_upload(
            create_schema, namespace=create_schema.service.value
        )

        instance = File(
            organization=organization,
            service=create_schema.service,
            is_enabled=True,
            is_uploaded=False,
            **upload.model_dump(exclude={"upload", "organization_id", "size_readable"}),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        return FileUpload.model_validate_overlay(
            upload,
            is_uploaded=instance.is_uploaded,
            version=instance.version,
            service=create_schema.service,
        )

    async def complete_upload(
        self,
        session: AsyncSession,
        *,
        file: File,
        completed_schema: FileUploadCompleted,
    ) -> File:
        s3_service = S3_SERVICES[file.service]
        s3file = s3_service.complete_multipart_upload(completed_schema)

        if file.mime_type == SVG_MIME_TYPE and file.service in SVG_SANITIZED_SERVICES:
            s3file = self._sanitize_svg(s3_service, s3file)
            file.size = s3file.size
            file.checksum_sha256_base64 = s3file.checksum_sha256_base64
            file.checksum_sha256_hex = s3file.checksum_sha256_hex

        file.is_uploaded = True

        if s3file.checksum_etag:
            file.checksum_etag = s3file.checksum_etag

        if s3file.last_modified_at:
            file.last_modified_at = s3file.last_modified_at

        if s3file.storage_version:
            file.storage_version = s3file.storage_version

        session.add(file)
        await session.flush()
        assert file.checksum_etag is not None
        assert file.last_modified_at is not None

        return file

    def _sanitize_svg(self, s3_service: S3Service, s3file: S3File) -> S3File:
        s3_object = s3_service.get_object_or_raise(s3file.path)
        if s3_object["ContentLength"] > s3file.size:
            s3_service.delete_file(s3file.path)
            raise BadRequest("Uploaded file is larger than its declared size")
        try:
            sanitized = filter_svg(s3_object["Body"].read(), SVG_DATA_URL_MIME_TYPES)
        except ValueError as e:
            s3_service.delete_file(s3file.path)
            raise BadRequest(f"Invalid SVG file: {e}") from e
        return s3_service.replace_object(s3file, sanitized)

    def generate_download_url(self, file: File) -> tuple[str, datetime]:
        """Generate a presigned download URL for a file."""
        s3_service = S3_SERVICES[file.service]
        return s3_service.generate_presigned_download_url(
            path=file.path,
            filename=file.name,
            mime_type=file.mime_type,
        )

    def generate_downloadable_schema(self, file: File) -> FileDownload:
        url, expires_at = self.generate_download_url(file)
        return FileDownload.from_presigned(file, url=url, expires_at=expires_at)

    async def delete(self, session: AsyncSession, *, file: File) -> bool:
        file.set_deleted_at()
        session.add(file)
        assert file.is_deleted

        # Delete ProductMedia association table records
        statement = sql.delete(ProductMedia).where(ProductMedia.file_id == file.id)
        await session.execute(statement)

        s3_service = S3_SERVICES[file.service]
        deleted = s3_service.delete_file(file.path)
        log.info("file.delete", file_id=file.id, s3_deleted=deleted)
        return True

    async def get_selectable_product_media_file(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        *,
        organization_id: uuid.UUID,
    ) -> ProductMediaFile | None:
        statement = sql.select(ProductMediaFile).where(
            File.id == id,
            File.organization_id == organization_id,
            File.is_uploaded,
            File.is_enabled,
            ~File.is_deleted,
            File.flagged_malicious_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def flag_malicious(
        self,
        session: AsyncSession,
        *,
        file: File,
        scan_result_details: dict[str, Any],
    ) -> File:
        if file.flagged_malicious_at is not None:
            return file

        repository = FileRepository.from_session(session)
        file = await repository.update(
            file,
            update_dict={
                "flagged_malicious_at": utc_now(),
                "flagged_malicious_details": scan_result_details,
            },
        )
        log.warning(
            "file.flagged_malicious",
            file_id=file.id,
            organization_id=file.organization_id,
            service=file.service,
            scan_result_details=scan_result_details,
        )
        organization = file.organization
        await notifications_service.send_to_org_members(
            session,
            org_id=file.organization_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_file_flagged_malicious,
                payload=MaintainerFileFlaggedMaliciousNotificationPayload(
                    file_name=file.name,
                    organization_name=organization.name,
                    organization_slug=organization.slug,
                    threat_names=[
                        threat["name"]
                        for threat in scan_result_details.get("threats", [])
                        if threat.get("name")
                    ],
                ),
            ),
        )
        return file


file = FileService()
