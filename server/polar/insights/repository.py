from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import InsightFeedback


class InsightFeedbackRepository(
    RepositoryBase[InsightFeedback], RepositoryIDMixin[InsightFeedback, UUID]
):
    model = InsightFeedback

    async def get_keys_with_feedback(
        self, organization_ids: Sequence[UUID]
    ) -> set[str]:
        """
        Insight keys that already have feedback, so the feed can hide them.

        Both `dismiss` and `not_useful` suppress the insight from reappearing.
        """
        if not organization_ids:
            return set()
        statement = (
            select(InsightFeedback.insight_key)
            .where(InsightFeedback.organization_id.in_(organization_ids))
            .where(InsightFeedback.deleted_at.is_(None))
        )
        result = await self.session.execute(statement)
        return set(result.scalars().all())
