import uuid

import pytest
from pytest_mock import MockerFixture

from polar.audit.repository import AuditRepository
from polar.audit.tasks import AuditLog, AuditLogDoesNotExist, log_recorded
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization


@pytest.mark.asyncio
class TestAudit:
    async def test_log_enqueued(
        self,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.audit.tasks.enqueue_job")

        org_id = organization.id

        audit_logger = AuditLog()
        log_id = await audit_logger.record(
            org_id=org_id, method="GET", path="/v1/payouts/", status=200
        )

        enqueue_job_mock.assert_called_once_with(
            "audit.log_recorded",
            log_id=log_id,
        )

    async def test_log_stored(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        org_id = organization.id

        audit_logger = AuditLog()
        log_id = await audit_logger.record(
            org_id=org_id, method="GET", path="/v1/payouts/", status=200
        )

        audit_repo = AuditRepository.from_session(session)
        log = await audit_repo.get_by_id(log_id)
        assert log is not None

    async def test_log_not_found(
        self,
    ) -> None:
        with pytest.raises(AuditLogDoesNotExist):
            await log_recorded(uuid.uuid4())
