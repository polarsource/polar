from datetime import datetime, timedelta

import pytest

from polar.config import settings
from polar.email.repository import EmailLogRepository
from polar.enums import EmailSender
from polar.kit.utils import utc_now
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def create_email_log(
    save_fixture: SaveFixture, *, created_at: datetime
) -> EmailLog:
    email_log = EmailLog(
        created_at=created_at,
        status=EmailLogStatus.sent,
        processor=EmailSender.resend,
        to_email_addr="customer@example.com",
        from_email_addr="acme@polar.sh",
        from_name="Acme",
        subject="Receipt",
        email_props={},
    )
    await save_fixture(email_log)
    return email_log


@pytest.mark.asyncio
class TestDeleteExpired:
    async def test_deletes_only_logs_past_retention_period(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        now = utc_now()
        expired = await create_email_log(
            save_fixture,
            created_at=now - settings.EMAIL_LOG_RETENTION_PERIOD - timedelta(days=1),
        )
        retained = await create_email_log(
            save_fixture,
            created_at=now - settings.EMAIL_LOG_RETENTION_PERIOD + timedelta(days=1),
        )

        repository = EmailLogRepository.from_session(session)
        await repository.delete_expired()

        assert await repository.get_by_id(expired.id) is None
        assert await repository.get_by_id(retained.id) is not None

    async def test_keeps_recent_logs(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        email_log = await create_email_log(save_fixture, created_at=utc_now())

        repository = EmailLogRepository.from_session(session)
        await repository.delete_expired()

        assert await repository.get_by_id(email_log.id) is not None
