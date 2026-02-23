from datetime import UTC, datetime

from sqlalchemy import select

from polar.kit.services import ResourceServiceReader
from polar.models import Campaign, User
from polar.postgres import AsyncSession


class CampaignService(ResourceServiceReader[Campaign]):
    async def get_eligible(self, session: AsyncSession, user: User) -> Campaign | None:
        code = user.campaign_code
        if not code:
            return None

        now = datetime.now(UTC)
        stmt = select(Campaign).where(
            Campaign.code == code,
            Campaign.starts_at <= now,
            Campaign.ends_at > now,
            Campaign.is_deleted.is_(False),
        )
        res = await session.execute(stmt)
        campaign = res.scalars().unique().one_or_none()
        if not campaign:
            return None

        # TODO: Check account threshold & user limits
        return campaign


campaign = CampaignService(Campaign)
