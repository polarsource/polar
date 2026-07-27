import contextlib
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.file.tasks import guardduty_scan_result
from polar.kit.utils import utc_now
from polar.models import File, Organization
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

_guardduty_scan_result = guardduty_scan_result.__wrapped__  # type: ignore[attr-defined]

THREATS = [{"name": "EICAR-Test-File (not a virus)"}]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


def build_scan_result(bucket_name: str, object_key: str) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "scanStatus": "COMPLETED",
        "resourceType": "S3_OBJECT",
        "s3ObjectDetails": {
            "bucketName": bucket_name,
            "objectKey": object_key,
            "eTag": "e0b4e5c5f76b4564d8ee6bbcd6e0e6f2",
            "versionId": None,
        },
        "scanResultDetails": {
            "scanResultStatus": "THREATS_FOUND",
            "threats": THREATS,
        },
    }


async def create_file(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    name: str = "whitepaper.pdf",
) -> File:
    file_id = uuid.uuid4()
    file = File(
        id=file_id,
        organization=organization,
        name=name,
        path=f"downloadable/{organization.id}/{file_id}/{name}",
        mime_type="application/pdf",
        size=1234,
        service=FileServiceTypes.downloadable,
        is_uploaded=True,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestGuardDutyScanResult:
    async def test_flags_file(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        file = await create_file(save_fixture, organization)
        mocker.patch(
            "polar.file.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _guardduty_scan_result(
            build_scan_result(settings.S3_FILES_BUCKET_NAME, file.path)
        )

        assert file.flagged_malicious_at is not None
        assert file.flagged_malicious_details == {
            "scanResultStatus": "THREATS_FOUND",
            "threats": THREATS,
        }

    async def test_idempotent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        file = await create_file(save_fixture, organization)
        flagged_at = utc_now()
        file.flagged_malicious_at = flagged_at
        file.flagged_malicious_details = {"scanResultStatus": "THREATS_FOUND"}
        await save_fixture(file)
        mocker.patch(
            "polar.file.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _guardduty_scan_result(
            build_scan_result(settings.S3_FILES_BUCKET_NAME, file.path)
        )

        assert file.flagged_malicious_at == flagged_at
        assert file.flagged_malicious_details == {"scanResultStatus": "THREATS_FOUND"}

    async def test_unknown_object_key(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        mocker.patch(
            "polar.file.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _guardduty_scan_result(
            build_scan_result(
                settings.S3_FILES_BUCKET_NAME, "e2e-artifacts/unknown.bin"
            )
        )

    async def test_unexpected_bucket(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        file = await create_file(save_fixture, organization)
        mocker.patch(
            "polar.file.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _guardduty_scan_result(build_scan_result("some-other-bucket", file.path))

        assert file.flagged_malicious_at is None
        assert file.flagged_malicious_details is None
