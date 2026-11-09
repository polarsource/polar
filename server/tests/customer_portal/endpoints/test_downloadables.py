from datetime import timedelta
from urllib.parse import parse_qs, unquote, urlparse

import pytest
from freezegun import freeze_time
from httpx import AsyncClient

from polar.benefit.strategies.downloadables.schemas import (
    BenefitDownloadablesCreateProperties,
)
from polar.config import settings
from polar.customer_portal.schemas.downloadables import DownloadableRead
from polar.kit.utils import utc_now
from polar.models import Customer, File, Organization, Product
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.downloadable import TestDownloadable


@pytest.mark.anyio
class TestDownloadablesEndpoints:
    async def test_anonymous_list_401s(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 401

    async def test_anonymous_download_401s(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-portal/downloadables/i-am-hacker")
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_wrong_token_404s(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )

        # List of downloadables
        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        downloadable_list = data["items"]
        pagination = data["pagination"]
        assert pagination["total_count"] == 1
        assert len(downloadable_list) == 1
        downloadable = downloadable_list[0]

        # Revoke the benefit
        await TestDownloadable.run_revoke_task(session, redis, benefit, customer)

        # Polar download endpoint will now 404
        response = await client.get(
            "/v1/customer-portal/downloadables/i-am-a-hacker", follow_redirects=False
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_expired_token_410s(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )

        # List of downloadables
        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        downloadable_list = data["items"]
        pagination = data["pagination"]
        assert pagination["total_count"] == 1
        assert len(downloadable_list) == 1
        downloadable = DownloadableRead(**downloadable_list[0])
        polar_download_url = downloadable.file.download.url

        # Polar download endpoint gives presigned S3 redirect
        response = await client.get(polar_download_url, follow_redirects=False)
        assert response.status_code == 302
        s3_download_url = response.headers.get("location", None)
        assert s3_download_url

        expires_at = downloadable.file.download.expires_at
        with freeze_time(expires_at + timedelta(seconds=1)):
            response = await client.get(polar_download_url, follow_redirects=False)
            assert response.status_code == 410

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_polar_disabled_file_vanishes(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )

        # List of downloadables
        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        downloadable_list = data["items"]
        pagination = data["pagination"]
        assert pagination["total_count"] == 1
        assert len(downloadable_list) == 1
        downloadable = downloadable_list[0]
        assert downloadable["file"]["id"] == str(uploaded_logo_jpg.id)

        # Disable the file
        statement = (
            sql.update(File)
            .where(File.id == uploaded_logo_jpg.id)
            .values(is_enabled=False)
        )
        await session.execute(statement)

        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        downloadable_list = data["items"]
        pagination = data["pagination"]
        assert pagination["total_count"] == 0
        assert len(downloadable_list) == 0

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_flagged_malicious_file_vanishes(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )

        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == 1
        polar_download_url = data["items"][0]["file"]["download"]["url"]

        statement = (
            sql.update(File)
            .where(File.id == uploaded_logo_jpg.id)
            .values(flagged_malicious_at=utc_now())
        )
        await session.execute(statement)

        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == 0
        assert len(data["items"]) == 0

        response = await client.get(polar_download_url, follow_redirects=False)
        assert response.status_code == 410

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_download_redirect(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )

        # List of downloadables
        response = await client.get("/v1/customer-portal/downloadables/")
        assert response.status_code == 200
        data = response.json()
        downloadable_list = data["items"]
        pagination = data["pagination"]
        assert pagination["total_count"] == 1
        assert len(downloadable_list) == 1
        downloadable = downloadable_list[0]
        polar_download_url = downloadable["file"]["download"]["url"]

        # Polar download endpoint gives presigned S3 redirect
        response = await client.get(polar_download_url, follow_redirects=False)
        assert response.status_code == 302
        s3_download_url = response.headers.get("location", None)
        assert s3_download_url

        url = urlparse(s3_download_url)
        assert url.netloc == urlparse(settings.s3_presign_endpoint_url or "").netloc
        assert unquote(url.path) == (
            f"/{settings.S3_FILES_BUCKET_NAME}/{uploaded_logo_jpg.path}"
        )
        params = parse_qs(url.query)
        assert params["X-Amz-Signature"][0]
        assert params["response-content-type"] == [uploaded_logo_jpg.mime_type]
        assert uploaded_logo_jpg.name in params["response-content-disposition"][0]
        assert (
            downloadable["file"]["checksum_sha256_base64"]
            == uploaded_logo_jpg.checksum_sha256_base64
        )
        assert (
            downloadable["file"]["checksum_sha256_hex"]
            == uploaded_logo_jpg.checksum_sha256_hex
        )
