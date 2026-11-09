import base64
import hashlib
import uuid
from io import BytesIO

import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.exceptions import BadRequest
from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.file.schemas import FileUploadCompleted
from polar.file.service import file as file_service
from polar.integrations.aws.s3.client import client as s3_client
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
        self,
        client: AsyncClient,
        organization: Organization,
        logo_png: TestFile,
        s3_stub: Stubber,
    ) -> None:
        logo_png.stub_create(s3_stub, FileServiceTypes.downloadable)
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

    async def test_create_downloadable_with_non_ascii_name(
        self,
        session: AsyncSession,
        organization: Organization,
        non_ascii_file_name: TestFile,
        s3_stub: Stubber,
        mocker: MockerFixture,
    ) -> None:
        create_multipart_upload = mocker.spy(s3_client, "create_multipart_upload")
        created = await non_ascii_file_name.create(session, organization, s3_stub)

        assert created.path.endswith(f"/{non_ascii_file_name.name}")
        assert create_multipart_upload.call_args.kwargs["Metadata"][
            "polar-name"
        ].isascii()
        non_ascii_file_name.completed_parts(created)

    async def test_incomplete_upload(
        self,
        session: AsyncSession,
        organization: Organization,
        logo_jpg: TestFile,
        s3_stub: Stubber,
    ) -> None:
        created = await logo_jpg.create(session, organization, s3_stub)

        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id)
        assert record
        assert record.is_uploaded is False

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_complete_multipart_upload(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        logo_jpg: TestFile,
        s3_stub: Stubber,
    ) -> None:
        created = await logo_jpg.create(session, organization, s3_stub, parts=2)
        parts = logo_jpg.completed_parts(created)
        head = logo_jpg.stub_complete(s3_stub, created, parts)

        response = await client.post(
            f"/v1/files/{created.id}/uploaded",
            json=FileUploadCompleted(
                id=created.upload.id, path=created.path, parts=parts
            ).model_dump(mode="json"),
        )

        assert response.status_code == 200
        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id)
        assert record
        assert record.is_uploaded is True
        assert record.storage_version == head["VersionId"]
        assert record.checksum_etag == head["ETag"]
        assert record.checksum_sha256_hex == logo_jpg.hex


@pytest.mark.anyio
class TestSVGSanitization:
    async def _upload(
        self,
        session: AsyncSession,
        organization: Organization,
        file: TestFile,
        s3_stub: Stubber,
        declared_size: int | None = None,
    ) -> tuple[File, FileUploadCompleted]:
        create_schema = file.build_product_media_create(organization.id)
        if declared_size is not None:
            create_schema = create_schema.model_copy(update={"size": declared_size})
        file.stub_create(s3_stub, create_schema.service)
        created = await file_service.generate_presigned_upload(
            session, organization=organization, create_schema=create_schema
        )
        parts = file.completed_parts(created)
        file.stub_complete(s3_stub, created, parts)
        s3_stub.add_response(
            "get_object",
            {
                "ContentLength": file.size,
                "Body": StreamingBody(BytesIO(file.data), file.size),
            },
            {
                "Bucket": S3_SERVICES[created.service].bucket,
                "Key": created.path,
                "ChecksumMode": "ENABLED",
            },
        )
        repository = FileRepository.from_session(session)
        record = await repository.get_by_id(created.id)
        assert record
        return record, FileUploadCompleted(
            id=created.upload.id, path=created.path, parts=parts
        )

    async def test_strips_scripts(
        self,
        session: AsyncSession,
        organization: Organization,
        malicious_svg: TestFile,
        s3_stub: Stubber,
    ) -> None:
        record, completed_schema = await self._upload(
            session, organization, malicious_svg, s3_stub
        )
        sanitized = (
            b'<?xml version="1.0" encoding="utf-8"?>\n'
            b'<svg xmlns="http://www.w3.org/2000/svg" height="100" width="100">\n'
            b'  \n  <a>\n    <circle cx="50" cy="50" fill="blue" r="40"/>\n  </a>\n  \n</svg>'
        )
        digest = hashlib.sha256(sanitized)
        checksum = base64.b64encode(digest.digest()).decode()
        metadata = {
            "polar-id": str(record.id),
            "polar-organization-id": str(organization.id),
            "polar-name": record.name,
            "polar-size": str(len(sanitized)),
            "polar-sha256-base64": checksum,
            "polar-sha256-hex": digest.hexdigest(),
        }
        object_params = {
            "Bucket": S3_SERVICES[record.service].bucket,
            "Key": record.path,
        }
        s3_stub.add_response(
            "put_object",
            {},
            {
                **object_params,
                "Body": sanitized,
                "ContentType": record.mime_type,
                "ChecksumAlgorithm": "SHA256",
                "ChecksumSHA256": checksum,
                "Metadata": metadata,
            },
        )
        s3_stub.add_response(
            "head_object",
            {
                "ContentType": record.mime_type,
                "Metadata": metadata,
                "ETag": '"sanitized-svg"',
                "LastModified": utc_now(),
            },
            object_params,
        )

        completed = await file_service.complete_upload(
            session, file=record, completed_schema=completed_schema
        )

        assert completed.size == len(sanitized)
        assert completed.checksum_sha256_hex == digest.hexdigest()

    async def test_downloadable_untouched(
        self,
        session: AsyncSession,
        organization: Organization,
        malicious_svg: TestFile,
        s3_stub: Stubber,
    ) -> None:
        created = await malicious_svg.create(session, organization, s3_stub)
        parts = malicious_svg.completed_parts(created)
        malicious_svg.stub_complete(s3_stub, created, parts)
        record = await FileRepository.from_session(session).get_by_id(created.id)
        assert record

        completed = await file_service.complete_upload(
            session,
            file=record,
            completed_schema=FileUploadCompleted(
                id=created.upload.id, path=created.path, parts=parts
            ),
        )

        assert completed.checksum_sha256_hex == malicious_svg.hex
        assert completed.is_uploaded

    @pytest.mark.parametrize(
        ("asset", "declared_size", "error"),
        [
            ("malformed.svg", None, "Invalid SVG file"),
            ("malicious.svg", 1, "larger than its declared size"),
        ],
    )
    async def test_rejects_invalid_upload(
        self,
        session: AsyncSession,
        organization: Organization,
        s3_stub: Stubber,
        asset: str,
        declared_size: int | None,
        error: str,
    ) -> None:
        record, completed_schema = await self._upload(
            session, organization, TestFile(asset), s3_stub, declared_size
        )
        s3_stub.add_response(
            "delete_object",
            {},
            {"Bucket": S3_SERVICES[record.service].bucket, "Key": record.path},
        )

        with pytest.raises(BadRequest, match=error):
            await file_service.complete_upload(
                session, file=record, completed_schema=completed_schema
            )

        assert record.is_uploaded is False


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
        s3_stub: Stubber,
    ) -> None:
        created = await logo_png.create(session, organization, s3_stub)
        s3_stub.add_response(
            "delete_object",
            {},
            {"Bucket": S3_SERVICES[created.service].bucket, "Key": created.path},
        )

        response = await client.delete(f"/v1/files/{created.id}")

        assert response.status_code == 204
