import uuid
from urllib.parse import parse_qs, urlencode, urlparse

import pytest
from httpx import AsyncClient, ReadError

from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.kit.utils import utc_now
from polar.models import Customer, Downloadable, Organization, UserOrganization
from polar.models.benefit import BenefitType
from polar.models.downloadable import DownloadableStatus
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.file import TestFile
from tests.fixtures.random_objects import (
    create_benefit,
    create_support_case_attachment_file,
)


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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

    @pytest.mark.auth
    async def test_download_statistics(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        downloaded_file = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="macos.dmg",
            service=FileServiceTypes.downloadable,
        )
        not_downloaded_file = await create_support_case_attachment_file(
            save_fixture,
            organization,
            name="windows.exe",
            service=FileServiceTypes.downloadable,
        )
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.downloadables,
            organization=organization,
            properties={
                "files": [str(downloaded_file.id), str(not_downloaded_file.id)],
                "archived": {},
            },
        )
        await save_fixture(
            Downloadable(
                file=downloaded_file,
                status=DownloadableStatus.granted,
                customer=customer,
                benefit=benefit,
                downloaded=3,
            )
        )
        await save_fixture(
            Downloadable(
                file=downloaded_file,
                status=DownloadableStatus.revoked,
                customer=customer_second,
                benefit=benefit,
                downloaded=2,
            )
        )
        other_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.downloadables,
            organization=organization,
            properties={"files": [str(downloaded_file.id)], "archived": {}},
        )
        await save_fixture(
            Downloadable(
                file=downloaded_file,
                status=DownloadableStatus.granted,
                customer=customer,
                benefit=other_benefit,
                downloaded=4,
            )
        )

        response = await client.get(
            "/v1/files/",
            params={
                "organization_id": str(organization.id),
                "ids": [str(downloaded_file.id), str(not_downloaded_file.id)],
                "benefit_id": str(benefit.id),
            },
        )

        assert response.status_code == 200
        files = {file["id"]: file for file in response.json()["items"]}
        assert files[str(downloaded_file.id)]["downloaders"] == 2
        assert files[str(downloaded_file.id)]["downloads"] == 5
        assert files[str(not_downloaded_file.id)]["downloaders"] == 0
        assert files[str(not_downloaded_file.id)]["downloads"] == 0

        response = await client.get(
            "/v1/files/",
            params={
                "organization_id": str(organization.id),
                "ids": str(downloaded_file.id),
            },
        )

        assert response.status_code == 200
        file = response.json()["items"][0]
        assert file["downloaders"] == 2
        assert file["downloads"] == 9


@pytest.mark.asyncio
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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
