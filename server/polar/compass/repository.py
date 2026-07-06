from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import InsightFeedback


class InsightFeedbackRepository(
    RepositoryBase[InsightFeedback], RepositoryIDMixin[InsightFeedback, UUID]
):
    model = InsightFeedback

    async def get_by_organization_and_key(
        self, organization_id: UUID, insight_key: str
    ) -> InsightFeedback | None:
        statement = self.get_base_statement().where(
            InsightFeedback.organization_id == organization_id,
            InsightFeedback.insight_key == insight_key,
            InsightFeedback.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)

    async def get_keys_with_feedback(
        self, organization_ids: Sequence[UUID], insight_keys: Sequence[str]
    ) -> set[str]:
        """
        Which of the given computed keys already have feedback, so the feed can
        hide them. Both `dismiss` and `not_useful` suppress the insight.

        Scoped to the keys just computed — not every key the organizations ever
        gave feedback on — so the query stays bounded as feedback accumulates.
        """
        if not organization_ids or not insight_keys:
            return set()
        statement = (
            select(InsightFeedback.insight_key)
            .where(InsightFeedback.organization_id.in_(organization_ids))
            .where(InsightFeedback.insight_key.in_(insight_keys))
            .where(InsightFeedback.deleted_at.is_(None))
        )
        result = await self.session.execute(statement)
        return set(result.scalars().all())
