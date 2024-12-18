from urllib.parse import parse_qs, urlencode, urlparse

import pytest
from httpx import AsyncClient, ReadError

from polar.file.s3 import S3_SERVICES
from polar.file.service import file as file_service
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.file import TestFile


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

        assert response.status_code == 403

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

        record = await file_service.get(session, created.id, allow_deleted=True)
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

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
        assert record.is_uploaded is False

    async def test_upload_with_web_scope(
        self, session: AsyncSession, organization: Organization, logo_jpg: TestFile
    ) -> None:
        created = await logo_jpg.create(session, organization)
        uploaded = await logo_jpg.upload(created)
        await logo_jpg.complete(session, created, uploaded)

        record = await file_service.get(session, created.id, allow_deleted=True)
        assert record
        assert record.is_uploaded is True
