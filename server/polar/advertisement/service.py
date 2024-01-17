import uuid
from collections.abc import Sequence

from sqlalchemy import (
    select,
)

from polar.advertisement.schemas import CreateAdvertisementCampaign
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Subscription,
)
from polar.models.advertisement_campaign import AdvertisementCampaign


class AdvertisementCampaignService:
    async def get(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> AdvertisementCampaign | None:
        query = select(AdvertisementCampaign).where(AdvertisementCampaign.id == id)

        if not allow_deleted:
            query = query.where(Subscription.deleted_at.is_(None))

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def create(
        self,
        session: AsyncSession,
        create: CreateAdvertisementCampaign,
    ) -> AdvertisementCampaign:
        campaign = AdvertisementCampaign(
            subscription_id=create.subscription_id,
            format=create.format,
            image_url=create.image_url,
            text=create.text,
            link_url=create.link_url,
        )
        session.add(campaign)
        await session.commit()
        return campaign

    async def search(
        self,
        session: AsyncSession,
        subscription_id: uuid.UUID | None,
    ) -> Sequence[AdvertisementCampaign]:
        statement = select(AdvertisementCampaign).where(
            AdvertisementCampaign.deleted_at.is_(None)
        )

        if subscription_id:
            statement = statement.where(
                AdvertisementCampaign.subscription_id == subscription_id
            )

        res = await session.execute(statement)
        return res.scalars().unique().all()


advertisement_campaign_service = AdvertisementCampaignService()
