from temporalio import activity

from polar.kit.db.postgres import AsyncSessionMaker

from .service import activity as activity_service


class ActivityActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker) -> None:
        self.sessionmaker = sessionmaker

    @activity.defn
    async def classify_due_spans(self) -> int:
        async with self.sessionmaker() as session:
            count = await activity_service.classify_due(session)
            await session.commit()
            return count
