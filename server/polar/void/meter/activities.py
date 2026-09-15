from temporalio import activity

from polar.kit.db.postgres import AsyncSessionMaker
from polar.void.organization.repository import OrganizationRepository
from polar.void.tinybird import TinybirdApi

from .service import meter as meter_service


class MeterActivities:
    def __init__(self, sessionmaker: AsyncSessionMaker, tinybird: TinybirdApi) -> None:
        self.sessionmaker = sessionmaker
        self.tinybird = tinybird

    @activity.defn
    async def cycle_meters(self) -> int:
        count = 0
        async with self.sessionmaker() as session:
            organization_ids = await OrganizationRepository.from_session(
                session
            ).enabled_ids()
        for organization_id in sorted(organization_ids):
            async with self.sessionmaker() as session:
                if not await OrganizationRepository.from_session(session).is_enabled(
                    organization_id
                ):
                    continue
                count += await meter_service.cycle(
                    session, self.tinybird, organization_id
                )
                await session.commit()
        return count
