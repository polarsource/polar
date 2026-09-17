from uuid import UUID

from temporalio import activity
from temporalio.client import Client

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker
from polar.void.sense.service import sense as sense_service

from .service import activity as activity_service
from .typesafe import TypeSafeError
from .workflows import ClassifySenseInput, ClassifySpanInput


class ActivityActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker, temporal: Client) -> None:
        self.sessionmaker = sessionmaker
        self.temporal = temporal

    @activity.defn
    async def classify_span(self, input: ClassifySpanInput) -> None:
        async with self.sessionmaker() as session:
            try:
                span = await activity_service.classify_span(
                    session,
                    UUID(input.organization_id),
                    UUID(input.activity_id),
                    input.span_key,
                )
                await session.commit()
                if span is not None:
                    await sense_service.touch_span(session, self.temporal, span)
            except TypeSafeError:
                await session.commit()
                if not settings.VOID_ACTIVITY_ENABLED:
                    return
                raise

    @activity.defn
    async def classify_sense(self, input: ClassifySenseInput) -> None:
        async with self.sessionmaker() as session:
            try:
                await sense_service.classify_sense(
                    session,
                    UUID(input.organization_id),
                    UUID(input.sense_id),
                    input.identity_id,
                    input.run_key,
                )
                await session.commit()
            except TypeSafeError:
                await session.commit()
                if not settings.VOID_ACTIVITY_ENABLED:
                    return
                raise
