from collections.abc import Sequence
from datetime import datetime

from polar.audit.repository import AuditRepository
from polar.auth.models import AuthSubject
from polar.kit.pagination import PaginationParams
from polar.models import Organization, User
from polar.models.audit import Audit
from polar.postgres import AsyncReadSession


class AuditService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        start_ts: datetime | None = None,
        end_ts: datetime | None = None,
    ) -> tuple[Sequence[Audit], int]:
        repository = AuditRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if start_ts is not None:
            statement = statement.where(Audit.start_timestamp >= start_ts)

        if end_ts is not None:
            statement = statement.where(Audit.end_timestamp <= end_ts)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )


audit = AuditService()
