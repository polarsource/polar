import base64
from urllib.parse import parse_qs, urlencode, urlparse
from uuid import UUID

import pytest
from httpx import AsyncClient, ReadError, Response

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.file.schemas import FileRead, FileUpload, FileUploadCompleted
from polar.file.service import file as file_service
from polar.file.service import s3_service
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.integrations.aws.s3.schemas import (
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
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
    ) -> FileUpload:
        assert response.status_code == 200
        data = response.json()
        valid = FileUpload(**data)

        assert valid.is_uploaded is False
        assert valid.name == file.name
        assert valid.size == file.size
        assert valid.mime_type == file.mime_type
        assert valid.checksum_sha256_base64 == file.base64
        assert valid.checksum_sha256_hex == file.hex
        assert len(valid.upload.parts) == parts
        return valid

    async def upload_part_and_test(
        self,
        minio_client: AsyncClient,
        upload_id: str,
        part: S3FileUploadPart,
        file: TestFile,
    ) -> S3FileUploadCompletedPart:
        upload_url = part.url
        url = urlparse(upload_url)
        params = parse_qs(url.query)

        def p(name: str) -> str:
            return params[name][0]

        assert int(p("partNumber")) == part.number
        assert p("uploadId") == upload_id
        assert p("X-Amz-Signature")
        assert int(p("X-Amz-Expires")) == settings.S3_FILES_PRESIGN_TTL

        chunk = file.get_chunk(part)

        upload = await minio_client.put(upload_url, content=chunk, headers=part.headers)

        assert upload.status_code == 200
        etag = upload.headers.get("ETag")
        assert etag
        return S3FileUploadCompletedPart(
            number=part.number,
            checksum_etag=etag,
            checksum_sha256_base64=part.checksum_sha256_base64,
        )

    async def upload_multiparts_and_test(
        self,
        created: FileUpload,
        file: TestFile,
    ) -> list[S3FileUploadCompletedPart]:
        completed = []
        async with AsyncClient() as minio_client:
            for part in created.upload.parts:
                uploaded = await self.upload_part_and_test(
                    minio_client,
                    created.upload.id,
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
        created = self.ensure_expected_create_response(
            response, organization_id, file=logo_png
        )

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
        created = self.ensure_expected_create_response(
            response, organization_id, file=logo_jpg
        )

        await self.upload_multiparts_and_test(created, file=logo_jpg)

        # S3 object is not available until we fully complete it
        with pytest.raises(S3FileError):
            s3_service.get_head_or_raise(created.path)

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
        assert record.is_uploaded is False

    @pytest.mark.http_auto_expunge
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_upload_without_signature(
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
        created = self.ensure_expected_create_response(
            response, organization_id, file=logo_jpg
        )

        part = created.upload.parts[0]

        upload_url = part.url
        url = urlparse(upload_url)
        qs = parse_qs(url.query)

        tampered_query = urlencode(
            {
                "uploadId": created.upload.id,
                "partNumber": qs["partNumber"][0],
                "X-Amz-Algorithm": qs["X-Amz-Algorithm"][0],
                "X-Amz-Credential": qs["X-Amz-Credential"][0],
                "X-Amz-Date": qs["X-Amz-Date"][0],
                "X-Amz-Expires": qs["X-Amz-Expires"][0],
                "X-Amz-SignedHeaders": qs["X-Amz-SignedHeaders"][0],
                "X-Amz-Signature": "i-am-a-hacker",
            }
        )
        tampered_url = f"{url.scheme}://{url.netloc}{url.path}?{tampered_query}"

        async with AsyncClient() as minio_client:
            try:
                failed = False
                res = await minio_client.put(
                    tampered_url, content=logo_jpg.data, headers=part.headers
                )
                # TODO
                # Investigate this issue with httpx raising ReadError instead
                # of handling the denied request (sometimes)
                failed = res.status_code != 200
            except ReadError:
                failed = True

            assert failed

        # S3 object is definitely not available
        with pytest.raises(S3FileError):
            s3_service.get_head_or_raise(created.path)

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
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
        created = self.ensure_expected_create_response(
            response, organization_id, file=logo_jpg
        )

        uploaded_parts = await self.upload_multiparts_and_test(created, file=logo_jpg)

        payload = FileUploadCompleted(
            id=created.upload.id, path=created.path, parts=uploaded_parts
        )
        payload_json = payload.model_dump(mode="json")

        completed = await client.post(
            f"/api/v1/files/{created.id}/uploaded",
            json=payload_json,
        )

        assert completed.status_code == 200
        upload_data = completed.json()
        uploaded = FileRead(**upload_data)

        assert uploaded.id == created.id
        assert uploaded.is_uploaded is True
        s3_object = s3_service.get_object_or_raise(uploaded.path)
        metadata = s3_object["Metadata"]

        assert s3_object["ETag"] == uploaded.checksum_etag
        assert metadata["polar-id"] == str(uploaded.id)
        assert metadata["polar-organization-id"] == str(uploaded.organization_id)
        assert metadata["polar-name"] == uploaded.name
        assert metadata["polar-size"] == str(logo_jpg.size)
        assert s3_object["ContentLength"] == logo_jpg.size
        assert s3_object["ContentType"] == logo_jpg.mime_type

        digests = []
        for part in uploaded_parts:
            checksum_sha256_base64 = part.checksum_sha256_base64
            if checksum_sha256_base64:
                digests.append(base64.b64decode(checksum_sha256_base64))

        valid_s3_checksum = S3FileUploadCompleted.generate_base64_multipart_checksum(
            digests
        )
        # S3 stores checksums as <Checksum>-<PartCount>
        assert s3_object["ChecksumSHA256"].split("-")[0] == valid_s3_checksum

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
        assert record.is_uploaded is True
