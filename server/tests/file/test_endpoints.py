import hashlib
import uuid
from urllib.parse import parse_qs, urlencode, urlparse

import pytest
from httpx import AsyncClient, ReadError

from polar.exceptions import BadRequest
from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.file.schemas import FileUploadCompleted
from polar.file.service import file as file_service
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.kit.utils import utc_now
from polar.models import File, Organization, UserOrganization
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.file import TestFile
from tests.fixtures.random_objects import create_support_case_attachment_file


@pytest.mark.anyio
class TestEndpoints:
    async def test_anonymous_create_401(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post("/v1/files/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_create_downloadable_without_scopes(
        self, client: AsyncClient, organization: Organization, logo_png: TestFile
    ) -> None:
        response = await client.post(
            "/v1/files/",
            json=logo_png.build_create(organization.id).model_dump(mode="json"),
        )

        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_can_upload_file_without_organization_id(
        self, client: AsyncClient, organization: Organization, logo_png: TestFile
    ) -> None:
        response = await client.post(
            "/v1/files/",
            json=logo_png.build_create(organization.id).model_dump(
                mode="json", exclude={"organization_id"}
            ),
        )

        logo_png.validate_create_response(response, organization.id)

    @pytest.mark.auth
    async def test_create_with_too_many_parts(
        self, client: AsyncClient, organization: Organization, logo_png: TestFile
    ) -> None:
        payload = logo_png.build_create(organization.id).model_dump(mode="json")
        part = payload["upload"]["parts"][0]
        payload["upload"]["parts"] = [{**part, "number": i + 1} for i in range(10_001)]

        response = await client.post("/v1/files/", json=payload)

        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any(
            error["type"] == "too_long" and "parts" in error["loc"] for error in errors
        )

    async def test_create_downloadable_with_web_scope(
        self, session: AsyncSession, organization: Organization, logo_png: TestFile
    ) -> None:
        await logo_png.create(session, organization)

    async def test_create_downloadable_with_non_ascii_name(
        self,
        session: AsyncSession,
        organization: Organization,
        non_ascii_file_name: TestFile,
    ) -> None:
        await non_ascii_file_name.create(session, organization)

    async def test_incomplete_upload_with_web_scope(
        self,
        session: AsyncSession,
        organization: Organization,
        logo_jpg: TestFile,
    ) -> None:
        created = await logo_jpg.create(session, organization)

        await logo_jpg.upload(created)

        # S3 object is not available until we fully complete it
        with pytest.raises(S3FileError):
            s3_service = S3_SERVICES[created.service]
            s3_service.get_head_or_raise(created.path)

        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id, include_deleted=True)
        assert record
        assert record.is_uploaded is False

    async def test_upload_without_signature(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        created = await logo_jpg.create(session, organization)

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

        try:
            failed = False
            res = await logo_jpg.put_upload(
                tampered_url, logo_jpg.data, headers=part.headers
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
            s3_service = S3_SERVICES[created.service]
            s3_service.get_head_or_raise(created.path)

        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id, include_deleted=True)
        assert record
        assert record.is_uploaded is False

    async def test_upload_with_web_scope(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        created = await logo_jpg.create(session, organization)
        uploaded = await logo_jpg.upload(created)
        await logo_jpg.complete(session, created, uploaded)

        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id, include_deleted=True)
        assert record
        assert record.is_uploaded is True


@pytest.mark.anyio
class TestCompleteUpload:
    async def _upload(
        self, session: AsyncSession, organization: Organization, file: TestFile
    ) -> tuple[File, FileUploadCompleted]:
        created = await file.create(session, organization)
        uploaded = await file.upload(created)
        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id)
        assert record
        return record, FileUploadCompleted(
            id=created.upload.id, path=created.path, parts=uploaded
        )

    async def test_path_mismatch(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(session, organization, logo_jpg)
        completed_schema.path = f"{record.path}-other"

        with pytest.raises(BadRequest, match="upload.path"):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False

    async def test_unknown_upload_id(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(session, organization, logo_jpg)
        completed_schema.id = str(record.id)

        with pytest.raises(BadRequest, match="upload.id"):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False

    async def test_invalid_part_etag(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(session, organization, logo_jpg)
        completed_schema.parts[0].checksum_etag = '"00000000000000000000000000000000"'

        with pytest.raises(BadRequest, match="checksum_etag"):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False

    @pytest.mark.auth
    async def test_endpoint_unknown_upload_id(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        logo_jpg: TestFile,
    ) -> None:
        record, completed_schema = await self._upload(session, organization, logo_jpg)
        completed_schema.id = str(record.id)

        response = await client.post(
            f"/v1/files/{record.id}/uploaded",
            json=completed_schema.model_dump(mode="json"),
        )

        assert response.status_code == 400
        assert "upload.id" in response.json()["detail"]


@pytest.mark.anyio
class TestSVGSanitization:
    async def _upload(
        self,
        session: AsyncSession,
        organization: Organization,
        file: TestFile,
        declared_size: int | None = None,
    ) -> tuple[File, FileUploadCompleted]:
        create_schema = file.build_product_media_create(organization.id)
        if declared_size is not None:
            create_schema = create_schema.model_copy(update={"size": declared_size})
        created = await file_service.generate_presigned_upload(
            session, organization=organization, create_schema=create_schema
        )
        uploaded = await file.upload(created)
        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id)
        assert record
        return record, FileUploadCompleted(
            id=created.upload.id, path=created.path, parts=uploaded
        )

    async def test_strips_scripts(
        self, session: AsyncSession, organization: Organization, malicious_svg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(
            session, organization, malicious_svg
        )
        completed = await file_service.complete_upload(
            session, file=record, completed_schema=completed_schema
        )

        s3_object = S3_SERVICES[completed.service].get_object_or_raise(completed.path)
        sanitized = s3_object["Body"].read()
        assert b"<circle" in sanitized
        for forbidden in (b"<script", b"onload", b"evil.example", b"<form"):
            assert forbidden not in sanitized
        assert completed.size == len(sanitized)
        assert completed.checksum_sha256_hex == hashlib.sha256(sanitized).hexdigest()

    async def test_downloadable_untouched(
        self, session: AsyncSession, organization: Organization, malicious_svg: TestFile
    ) -> None:
        created = await malicious_svg.create(session, organization)
        uploaded = await malicious_svg.upload(created)
        await malicious_svg.complete(session, created, uploaded)

    async def test_rejects_malformed(
        self, session: AsyncSession, organization: Organization, malformed_svg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(
            session, organization, malformed_svg
        )
        with pytest.raises(BadRequest):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False
        with pytest.raises(S3FileError):
            S3_SERVICES[record.service].get_head_or_raise(record.path)

    async def test_rejects_larger_than_declared(
        self, session: AsyncSession, organization: Organization, malicious_svg: TestFile
    ) -> None:
        record, completed_schema = await self._upload(
            session, organization, malicious_svg, declared_size=1
        )
        with pytest.raises(BadRequest):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False
        with pytest.raises(S3FileError):
            S3_SERVICES[record.service].get_head_or_raise(record.path)


@pytest.mark.anyio
class TestList:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_excludes_support_case_attachments(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_support_case_attachment_file(save_fixture, organization)
        visible = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="media.jpg",
            service=FileServiceTypes.product_media,
        )

        response = await client.get(
            "/v1/files/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert [item["id"] for item in json["items"]] == [str(visible.id)]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_includes_flagged_malicious(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        flagged = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="malware.zip",
            service=FileServiceTypes.downloadable,
        )
        flagged.flagged_malicious_at = utc_now()
        await save_fixture(flagged)
        visible = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="archive.zip",
            service=FileServiceTypes.downloadable,
        )
        media = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="media.jpg",
            service=FileServiceTypes.product_media,
        )

        response = await client.get(
            "/v1/files/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        items = {item["id"]: item for item in json["items"]}
        assert set(items) == {str(flagged.id), str(visible.id), str(media.id)}
        assert items[str(flagged.id)]["flagged_malicious_at"] is not None
        assert items[str(visible.id)]["flagged_malicious_at"] is None
        assert "flagged_malicious_at" not in items[str(media.id)]


@pytest.mark.anyio
class TestDownload:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/files/{uuid.uuid4()}/download")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/files/{uuid.uuid4()}/download")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_uploaded(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="release.zip",
            service=FileServiceTypes.downloadable,
            is_uploaded=False,
        )

        response = await client.get(f"/v1/files/{file.id}/download")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_support_case_attachment_not_permitted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(save_fixture, organization)

        response = await client.get(f"/v1/files/{file.id}/download")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_flagged_malicious_not_permitted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="malware.zip",
            service=FileServiceTypes.downloadable,
        )
        file.flagged_malicious_at = utc_now()
        await save_fixture(file)

        response = await client.get(f"/v1/files/{file.id}/download")

        assert response.status_code == 403
        assert "download" not in response.json()

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_cannot_download_another_organizations_file(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        file = await create_support_case_attachment_file(
            save_fixture,
            organization_second,
            name="release.zip",
            service=FileServiceTypes.downloadable,
        )

        response = await client.get(f"/v1/files/{file.id}/download")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="agent"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="release.zip",
            service=FileServiceTypes.downloadable,
        )

        response = await client.get(f"/v1/files/{file.id}/download")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(file.id)
        assert json["service"] == "downloadable"
        assert json["download"]["url"]
        assert json["download"]["expires_at"]


@pytest.mark.anyio
class TestUpdate:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_support_case_attachment_not_permitted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(save_fixture, organization)

        response = await client.patch(
            f"/v1/files/{file.id}", json={"name": "renamed.pdf"}
        )

        assert response.status_code == 403


@pytest.mark.anyio
class TestDelete:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_support_case_attachment_not_permitted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = await create_support_case_attachment_file(save_fixture, organization)

        response = await client.delete(f"/v1/files/{file.id}")

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_other_services_remain_deletable(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        logo_png: TestFile,
    ) -> None:
        created = await logo_png.create(session, organization)

        response = await client.delete(f"/v1/files/{created.id}")

        assert response.status_code == 204
