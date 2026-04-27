from datetime import datetime
from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import Feedback


class FeedbackRepository(
    RepositorySoftDeletionMixin[Feedback],
    RepositoryBase[Feedback],
):
    model = Feedback

    async def count_recent_by_user(self, user_id: UUID, *, since: datetime) -> int:
        statement = (
            self.get_base_statement()
            .where(Feedback.user_id == user_id)
            .where(Feedback.created_at >= since)
        )
        return await self.count(statement)

    async def get_oldest_recent_by_user(
        self, user_id: UUID, *, since: datetime
    ) -> Feedback | None:
        statement = (
            self.get_base_statement()
            .where(Feedback.user_id == user_id)
            .where(Feedback.created_at >= since)
            .order_by(Feedback.created_at.asc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)
