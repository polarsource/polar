from uuid import UUID

from sqlalchemy import Select, func
from sqlalchemy.orm import undefer

from polar.auth.models import AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CompassThread, CompassThreadMessage


class CompassThreadRepository(
    RepositorySoftDeletionIDMixin[CompassThread, UUID],
    RepositorySoftDeletionMixin[CompassThread],
    RepositoryBase[CompassThread],
):
    model = CompassThread

    def get_readable_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[CompassThread]]:
        """Threads owned by the caller: their own threads, in organizations
        they can still read analytics for.
        """
        return self.get_base_statement().where(
            CompassThread.user_id == auth_subject.subject.id,
            CompassThread.organization_id.in_(
                select_accessible_org_ids(
                    auth_subject, permission=OrganizationPermission.analytics_read
                )
            ),
        )

    def apply_recency_order(
        self, statement: Select[tuple[CompassThread]]
    ) -> Select[tuple[CompassThread]]:
        return statement.order_by(
            func.coalesce(CompassThread.modified_at, CompassThread.created_at).desc(),
            CompassThread.id.desc(),
        )


class CompassThreadMessageRepository(
    RepositorySoftDeletionIDMixin[CompassThreadMessage, UUID],
    RepositorySoftDeletionMixin[CompassThreadMessage],
    RepositoryBase[CompassThreadMessage],
):
    model = CompassThreadMessage

    def get_statement_by_thread(
        self, thread_id: UUID
    ) -> Select[tuple[CompassThreadMessage]]:
        return (
            self.get_base_statement()
            .where(CompassThreadMessage.thread_id == thread_id)
            .order_by(
                CompassThreadMessage.created_at.desc(),
                CompassThreadMessage.id.desc(),
            )
        )

    def get_replay_statement(
        self, thread_id: UUID, limit: int
    ) -> Select[tuple[CompassThreadMessage]]:
        return (
            self.get_statement_by_thread(thread_id)
            .options(undefer(CompassThreadMessage.model_messages))
            .limit(limit)
        )
