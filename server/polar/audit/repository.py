from uuid import UUID

from sqlalchemy import Select, select

from polar.kit.repository import RepositoryBase
from polar.models.audit_log import AuditLog


class AuditLogRepository(RepositoryBase[AuditLog]):
    model = AuditLog

    def get_by_organization_statement(
        self,
        organization_id: UUID,
        *,
        resource_type: str | None = None,
        action: str | None = None,
        actor_id: UUID | None = None,
    ) -> Select[tuple[AuditLog]]:
        statement = select(self.model).where(
            self.model.organization_id == organization_id
        )

        if resource_type is not None:
            statement = statement.where(self.model.resource_type == resource_type)

        if action is not None:
            statement = statement.where(self.model.action == action)

        if actor_id is not None:
            statement = statement.where(self.model.actor_id == actor_id)

        statement = statement.order_by(self.model.created_at.desc())

        return statement
