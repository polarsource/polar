from uuid import UUID

from temporalio import activity
from temporalio.client import Client

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker

from .service import activity as activity_service
from .typesafe import TypeSafeError
from .workflows import ClassifySpanInput


class ActivityActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker, temporal: Client) -> None:
        self.sessionmaker = sessionmaker
        self.temporal = temporal

    @activity.defn
    async def classify_span(self, input: ClassifySpanInput) -> None:
        async with self.sessionmaker() as session:
            try:
                await activity_service.classify_span(
                    session,
                    UUID(input.organization_id),
                    UUID(input.activity_id),
                    input.span_key,
                )
                await session.commit()
            except TypeSafeError:
                await session.commit()
                if not settings.VOID_ACTIVITY_ENABLED:
                    return
                raise
