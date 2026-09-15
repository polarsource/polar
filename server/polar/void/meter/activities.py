from temporalio import activity

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker
from polar.void.tinybird import TinybirdApi

from .service import meter as meter_service


class MeterActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker, tinybird: TinybirdApi) -> None:
        self.sessionmaker = sessionmaker
        self.tinybird = tinybird

    @activity.defn
    async def cycle_meters(self) -> int:
        if not settings.VOID_ENABLED:
            return 0
        count = 0
        for organization_id in sorted(settings.VOID_ORGANIZATION_IDS):
            async with self.sessionmaker() as session:
                count += await meter_service.cycle(
                    session, self.tinybird, organization_id
                )
                await session.commit()
        return count
