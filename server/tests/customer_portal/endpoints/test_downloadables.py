import base64
import hashlib
from datetime import timedelta
from urllib.parse import urlparse

import pytest
from freezegun import freeze_time
from httpx import AsyncClient

from polar.benefit.strategies.downloadables.schemas import (
    BenefitDownloadablesCreateProperties,
)
from polar.customer_portal.schemas.downloadables import DownloadableRead
from polar.models import Customer, Downloadable, File, Member, Organization, Product
from polar.models.file import DownloadableFile, FileServiceTypes
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT, MEMBER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.downloadable import TestDownloadable
from tests.fixtures.random_objects import create_benefit_grant, create_member


@pytest.mark.asyncio
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
    async def test_signatureless_url_403s(
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

        without_signature = f"{url.scheme}://{url.netloc}{url.path}"
        async with AsyncClient() as mimio_client:
            response = await mimio_client.get(without_signature)

        assert response.status_code == 403

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
    async def test_download(
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

        # S3 Download works & matches our expectations
        async with AsyncClient() as mimio_client:
            response = await mimio_client.get(s3_download_url)

        assert response.status_code == 200
        assert len(response.content) == uploaded_logo_jpg.size

        h = hashlib.sha256()
        h.update(response.content)
        downloaded_base64 = base64.b64encode(h.digest()).decode("utf-8")
        downloaded_hex = h.hexdigest()
        assert uploaded_logo_jpg.checksum_sha256_base64 == downloaded_base64
        assert downloadable["file"]["checksum_sha256_base64"] == downloaded_base64
        assert uploaded_logo_jpg.checksum_sha256_hex == downloaded_hex
        assert downloadable["file"]["checksum_sha256_hex"] == downloaded_hex


async def _create_downloadable_file(
    save_fixture: SaveFixture, organization: Organization, name: str = "asset.bin"
) -> File:
    """Create an uploaded, enabled downloadable File row without hitting S3."""
    file = DownloadableFile(
        organization_id=organization.id,
        name=name,
        path=f"downloadables/{name}",
        mime_type="application/octet-stream",
        size=1024,
        service=FileServiceTypes.downloadable,
        is_uploaded=True,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestDownloadablesMemberAccess:
    """Members are entitled to a downloadable through their own benefit grant,
    not through Downloadable.member_id (which is shared across a customer's
    members)."""

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_with_grant_sees_downloadables(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        member: Member,
    ) -> None:
        file = await _create_downloadable_file(save_fixture, organization)
        benefit, _ = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(files=[file.id]),
        )

        # The member is entitled via their own benefit grant.
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            member=member,
        )

        response = await client.get("/v1/customer-portal/downloadables/")

        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == 1
        assert len(data["items"]) == 1

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_without_grant_sees_nothing(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        member: Member,
    ) -> None:
        file = await _create_downloadable_file(save_fixture, organization)
        await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(files=[file.id]),
        )

        # No benefit grant for this member -> no downloadables visible.
        response = await client.get("/v1/customer-portal/downloadables/")

        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == 0
        assert len(data["items"]) == 0

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_sees_downloadable_attributed_to_other_member(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        member: Member,
    ) -> None:
        """Reproduces the seat-based collision: a single downloadable row is
        shared per (customer, file, benefit), so its member_id points at whoever
        was granted first. A member entitled via their own grant must still see
        it."""
        file = await _create_downloadable_file(save_fixture, organization)
        benefit, _ = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(files=[file.id]),
        )

        # Attribute the shared downloadable row to a different member.
        other_member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="other.member@example.com",
        )
        await session.execute(
            sql.update(Downloadable)
            .where(Downloadable.customer_id == customer.id)
            .values(member_id=other_member.id)
        )

        # This member is entitled via their own grant.
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            member=member,
        )

        response = await client.get("/v1/customer-portal/downloadables/")

        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == 1
        assert len(data["items"]) == 1
