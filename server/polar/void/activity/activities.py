from uuid import UUID

from temporalio import activity

from polar.kit.db.postgres import AsyncSessionMaker

from .service import activity as activity_service
from .workflows import ClassifySpanInput


class ActivityActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker) -> None:
        self.sessionmaker = sessionmaker

    @activity.defn
    async def classify_span(self, input: ClassifySpanInput) -> None:
        async with self.sessionmaker() as session:
            await activity_service.classify_span(
                session,
                UUID(input.organization_id),
                UUID(input.activity_id),
                input.span_key,
            )
            await session.commit()
