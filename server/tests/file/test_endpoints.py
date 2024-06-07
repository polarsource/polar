from urllib.parse import parse_qs, urlencode, urlparse

import pytest
from httpx import AsyncClient, ReadError

from polar.auth.models import AuthSubject
from polar.file.service import file as file_service
from polar.file.service import s3_service
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.file import TestFile


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestEndpoints:
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
            json=logo_png.build_create_json(organization.id),
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
        await logo_png.create(client, organization_id)

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
        created = await logo_jpg.create(client, organization_id)

        await logo_jpg.upload(created)

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

        created = await logo_jpg.create(client, organization_id)

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
        created = await logo_jpg.create(client, organization_id)
        uploaded = await logo_jpg.upload(created)
        await logo_jpg.complete(client, created, uploaded)

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
        assert record.is_uploaded is True
