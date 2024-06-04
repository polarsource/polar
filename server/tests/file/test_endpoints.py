import base64
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest
from httpx import AsyncClient, Response

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.file.service import file as file_service
from polar.file.service import s3_service
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.integrations.aws.s3.schemas import (
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
    S3FileUploadMultipart,
    S3FileUploadPart,
)
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.file import TestFile


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestEndpoints:

    def ensure_expected_create_response(
        self, response: Response, organization_id: UUID, file: TestFile, parts: int = 1
    ) -> dict[str, Any]:
        assert response.status_code == 200
        data = response.json()

        assert data["id"] is not None
        assert data["is_uploaded"] is False
        assert data["organization_id"] == str(organization_id)
        assert data["name"] == file.name
        assert data["size"] == file.size
        assert data["mime_type"] == file.mime_type
        assert data["checksum_sha256_base64"] == file.base64
        assert data["checksum_sha256_hex"] == file.hex
        assert data["upload"]["id"]
        assert len(data["upload"]["parts"]) == parts
        for part in data["upload"]["parts"]:
            assert part["url"]
            assert part["expires_at"]
            assert part["headers"]

        return data

    async def upload_part_and_test(
        self,
        minio_client: AsyncClient,
        upload_id: str,
        part: S3FileUploadPart,
        file: TestFile,
    ) -> S3FileUploadCompletedPart:
        upload_url = part["url"]
        url = urlparse(upload_url)
        params = parse_qs(url.query)

        def p(name: str) -> str:
            return params[name][0]

        assert int(p("partNumber")) == part["number"]
        assert p("uploadId") == upload_id
        assert p("X-Amz-Signature")
        assert int(p("X-Amz-Expires")) == settings.S3_FILES_PRESIGN_TTL

        chunk = file.get_chunk(part)

        upload = await minio_client.put(
            upload_url, content=chunk, headers=part["headers"]
        )
        assert upload.status_code == 200
        etag = upload.headers.get("ETag", None)
        assert etag
        return dict(
            number=part["number"],
            checksum_etag=etag,
            checksum_sha256_base64=part.get("checksum_sha256_base64", None),
        )

    async def upload_multiparts_and_test(
        self, upload_id: str, parts: S3FileUploadMultipart, file: TestFile
    ) -> list[S3FileUploadCompletedPart]:
        completed = []
        async with AsyncClient() as minio_client:
            for part in parts:
                uploaded = await self.upload_part_and_test(
                    minio_client,
                    upload_id,
                    part=part,
                    file=file,
                )
                completed.append(uploaded)
        return completed

    async def test_anonymous_create_401(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post("/api/v1/files/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_create_downloadable_without_scopes(
        self, client: AsyncClient, organization: Organization, logo_png: TestFile
    ) -> None:
        response = await client.post(
            "/api/v1/files/",
            json=logo_png.build_create_payload(organization.id),
        )

        assert response.status_code == 403

    @pytest.mark.http_auto_expunge
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_create_downloadable_with_web_scope(
        self,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        user_organization_admin: UserOrganization,
        logo_png: TestFile,
    ) -> None:
        organization_id = user_organization_admin.organization_id

        response = await client.post(
            "/api/v1/files/",
            json=logo_png.build_create_payload(organization_id),
        )
        data = self.ensure_expected_create_response(
            response, organization_id, file=logo_png, parts=1
        )
        assert data["extension"] == "png"

    @pytest.mark.http_auto_expunge
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_incomplete_upload_with_web_scope(
        self,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        user_organization_admin: UserOrganization,
        logo_jpg: TestFile,
    ) -> None:
        organization_id = user_organization_admin.organization_id

        response = await client.post(
            "/api/v1/files/",
            json=logo_jpg.build_create_payload(organization_id),
        )
        data = self.ensure_expected_create_response(
            response, organization_id, file=logo_jpg, parts=1
        )
        assert data["extension"] == "jpg"

        file_id = data["id"]
        upload_id = data["upload"]["id"]
        upload_path = data["upload"]["path"]
        upload_parts = data["upload"]["parts"]
        uploaded = await self.upload_multiparts_and_test(
            upload_id, upload_parts, file=logo_jpg
        )

        # S3 object is not available until we fully complete it
        with pytest.raises(S3FileError):
            s3_head = s3_service.get_head_or_raise(upload_path)

        record = await file_service.get(session, file_id, allow_deleted=True)
        assert record.is_uploaded is False

    @pytest.mark.http_auto_expunge
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_upload_with_web_scope(
        self,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        user_organization_admin: UserOrganization,
        logo_jpg: TestFile,
    ) -> None:
        organization_id = user_organization_admin.organization_id

        response = await client.post(
            "/api/v1/files/",
            json=logo_jpg.build_create_payload(organization_id),
        )
        data = self.ensure_expected_create_response(
            response, organization_id, file=logo_jpg, parts=1
        )
        assert data["extension"] == "jpg"

        file_id = data["id"]
        upload_id = data["upload"]["id"]
        upload_path = data["upload"]["path"]
        upload_parts = data["upload"]["parts"]
        uploaded = await self.upload_multiparts_and_test(
            upload_id, upload_parts, file=logo_jpg
        )

        completed = await client.post(
            f"/api/v1/files/{file_id}/uploaded",
            json={"id": upload_id, "path": upload_path, "parts": uploaded},
        )

        assert completed.status_code == 200
        upload_data = completed.json()
        assert upload_data["id"] == file_id
        assert upload_data["is_uploaded"] is True
        s3_object = s3_service.get_object_or_raise(upload_path)
        metadata = s3_object["Metadata"]

        assert s3_object["ETag"] == upload_data["checksum_etag"]
        assert metadata["polar-id"] == file_id
        assert metadata["polar-organization-id"] == str(organization_id)
        assert metadata["polar-name"] == data["name"]
        assert metadata["polar-extension"] == data["extension"]
        assert metadata["polar-size"] == str(logo_jpg.size)
        assert s3_object["ContentLength"] == logo_jpg.size
        assert s3_object["ContentType"] == logo_jpg.mime_type

        digests = []
        for part in uploaded:
            checksum_sha256_base64 = part.get("checksum_sha256_base64")
            digests.append(base64.b64decode(checksum_sha256_base64))

        valid_s3_checksum = S3FileUploadCompleted.generate_base64_multipart_checksum(
            digests
        )
        # S3 stores checksums as <Checksum>-<PartCount>
        assert s3_object["ChecksumSHA256"].split("-")[0] == valid_s3_checksum

        record = await file_service.get(session, file_id, allow_deleted=True)
        assert record.is_uploaded is True
