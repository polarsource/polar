from collections.abc import AsyncGenerator

import httpx2
import pytest

from polar.backoffice.app import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import BackofficeUserSession, File, Organization
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_support_case_attachment_file


@pytest.fixture
async def backoffice_client(
    session: AsyncSession, backoffice_user_session: BackofficeUserSession
) -> AsyncGenerator[httpx2.AsyncClient]:
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: backoffice_user_session
    try:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


async def create_flagged_file(
    save_fixture: SaveFixture, organization: Organization
) -> File:
    file = await create_support_case_attachment_file(
        save_fixture,
        organization,
        name="setup.exe",
        service=FileServiceTypes.downloadable,
    )
    file.checksum_sha256_hex = "a" * 64
    file.flagged_malicious_at = utc_now()
    file.flagged_malicious_details = {
        "scanResultStatus": "THREATS_FOUND",
        "threats": [
            {
                "name": "Trojan.Generic",
                "source": "BITDEFENDER",
                "itemDetails": [{"hash": "b" * 64, "itemPath": None}],
            }
        ],
    }
    await save_fixture(file)
    return file


@pytest.mark.anyio
class TestList:
    async def test_flagged_filter(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        flagged = await create_flagged_file(save_fixture, organization)
        clean = await create_support_case_attachment_file(
            save_fixture, organization, name="clean.pdf"
        )

        response = await backoffice_client.get("/files/", params={"flagged": "true"})

        assert response.status_code == 200
        assert str(flagged.id) in response.text
        assert str(clean.id) not in response.text


@pytest.mark.anyio
class TestGet:
    async def test_flagged_shows_aws_ticket(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        file = await create_flagged_file(save_fixture, organization)

        response = await backoffice_client.get(f"/files/{file.id}")

        assert response.status_code == 200
        assert "AWS Support Ticket" in response.text
        assert f"Bucket: {settings.S3_FILES_BUCKET_NAME}" in response.text
        assert f"Object key: {file.path}" in response.text
        assert f"Object SHA-256: {'a' * 64}" in response.text
        assert "- Trojan.Generic (source: BITDEFENDER)" in response.text
        assert f"Item SHA-256: {'b' * 64}" in response.text

    async def test_not_flagged_has_no_ticket(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        file = await create_support_case_attachment_file(save_fixture, organization)

        response = await backoffice_client.get(f"/files/{file.id}")

        assert response.status_code == 200
        assert "AWS Support Ticket" not in response.text
