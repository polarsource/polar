from datetime import UTC, datetime
from uuid import UUID

from polar.audit.repository import AuditRepository
from polar.exceptions import PolarTaskError
from polar.models import Audit
from polar.models.audit import AuditLog as Log
from polar.worker import (
    AsyncSessionMaker,
    TaskPriority,
    actor,
    enqueue_job,
)


class AuditLogDoesNotExist(PolarTaskError):
    def __init__(self, log_id: UUID) -> None:
        self.log_id = log_id
        message = f"The audit log with id {log_id} does not exist."
        super().__init__(message)


class AuditLog:
    def __init__(self) -> None:
        self.start_ts = datetime.now(tz=UTC)

    async def record(
        self,
        *,
        method: str,
        path: str,
        status: int,
        error: str | None = None,
        correlation_id: str | None = None,
        user_id: UUID | None = None,
        org_id: UUID | None = None,
    ) -> UUID:
        """
        Record the log and trigger a 'audit.log_recorded' event
        """
        end_ts = datetime.now(tz=UTC)

        async with AsyncSessionMaker() as session:
            log = Audit(
                account_id=user_id,
                organization_id=org_id,
                start_timestamp=self.start_ts,
                end_timestamp=end_ts,
                log=Log(
                    method=method,
                    path=path,
                    status=status,
                    error=error,
                    correlation_id=correlation_id,
                ),
            )

            session.add(log)
            await session.flush()

            enqueue_job("audit.log_recorded", log_id=log.id)

            return log.id


@actor(actor_name="audit.log_recorded", priority=TaskPriority.LOW)
async def log_recorded(log_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        audit_repo = AuditRepository.from_session(session)
        log = await audit_repo.get_by_id(log_id)

        if not log:
            raise AuditLogDoesNotExist(log_id)

        # do something wout the audit log
