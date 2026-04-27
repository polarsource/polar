from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Feedback
from polar.models.feedback import FeedbackStatus


class FeedbackRepository(
    RepositorySoftDeletionIDMixin[Feedback, UUID],
    RepositorySoftDeletionMixin[Feedback],
    RepositoryBase[Feedback],
):
    model = Feedback

    def get_by_status_statement(
        self, status: FeedbackStatus
    ) -> Select[tuple[Feedback]]:
        return (
            self.get_base_statement()
            .where(Feedback.status == status)
            .order_by(Feedback.created_at.desc())
        )
