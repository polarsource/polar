from uuid import UUID

from sqlalchemy import Select, func, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Feedback
from polar.models.feedback import FeedbackStatus, FeedbackType


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

    async def get_type_counts(self, status: FeedbackStatus) -> dict[FeedbackType, int]:
        """Return the number of (non-deleted) feedbacks per type for a status."""
        statement = (
            select(Feedback.type, func.count(Feedback.id))
            .where(Feedback.status == status, Feedback.deleted_at.is_(None))
            .group_by(Feedback.type)
        )
        result = await self.session.execute(statement)
        return {
            FeedbackType(feedback_type): count for feedback_type, count in result.all()
        }
