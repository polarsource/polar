import uuid
from collections.abc import Sequence

from sqlalchemy import (
    and_,
    select,
    update,
)

from polar.advertisement.schemas import (
    CreateAdvertisementCampaign,
    EditAdvertisementCampaign,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models.advertisement_campaign import AdvertisementCampaign
from polar.models.subscription_benefit_grant import SubscriptionBenefitGrant


class AdvertisementCampaignService:
    async def get(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> AdvertisementCampaign | None:
        query = select(AdvertisementCampaign).where(
            AdvertisementCampaign.id == id,
        )

        if not allow_deleted:
            query = query.where(AdvertisementCampaign.deleted_at.is_(None))

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def create(
        self,
        session: AsyncSession,
        create: CreateAdvertisementCampaign,
    ) -> AdvertisementCampaign:
        campaign = AdvertisementCampaign(
            subscription_id=create.subscription_id,
            subscription_benefit_id=create.subscription_benefit_id,
            image_url=str(create.image_url),
            image_url_dark=str(create.image_url_dark)
            if create.image_url_dark
            else None,
            text=create.text,
            link_url=str(create.link_url),
        )
        session.add(campaign)
        await session.commit()
        return campaign

    async def edit(
        self,
        session: AsyncSession,
        campaign: AdvertisementCampaign,
        edit: EditAdvertisementCampaign,
    ) -> AdvertisementCampaign:
        campaign.image_url = str(edit.image_url)
        campaign.image_url_dark = (
            str(edit.image_url_dark) if edit.image_url_dark else None
        )
        campaign.link_url = str(edit.link_url)
        campaign.text = edit.text
        await session.commit()
        return campaign

    async def track_view(
        self,
        session: AsyncSession,
        campaign: AdvertisementCampaign,
    ) -> None:
        stmt = (
            update(AdvertisementCampaign)
            .where(AdvertisementCampaign.id == campaign.id)
            .values({"views": AdvertisementCampaign.views + 1})
        )

        await session.execute(stmt)
        await session.commit()

    async def delete(
        self,
        session: AsyncSession,
        campaign: AdvertisementCampaign,
    ) -> AdvertisementCampaign:
        campaign.deleted_at = utc_now()
        await session.commit()
        return campaign

    async def search(
        self,
        session: AsyncSession,
        subscription_id: uuid.UUID | None = None,
        subscription_benefit_id: uuid.UUID | None = None,
    ) -> Sequence[AdvertisementCampaign]:
        statement = (
            select(AdvertisementCampaign)
            .join(
                SubscriptionBenefitGrant,
                onclause=and_(
                    SubscriptionBenefitGrant.subscription_benefit_id
                    == AdvertisementCampaign.subscription_benefit_id,
                    SubscriptionBenefitGrant.subscription_id
                    == AdvertisementCampaign.subscription_id,
                ),
            )
            .where(
                AdvertisementCampaign.deleted_at.is_(None),
                SubscriptionBenefitGrant.revoked_at.is_(None),
            )
        )

        if subscription_id:
            statement = statement.where(
                AdvertisementCampaign.subscription_id == subscription_id
            )
        if subscription_benefit_id:
            statement = statement.where(
                AdvertisementCampaign.subscription_benefit_id == subscription_benefit_id
            )

        res = await session.execute(statement)
        return res.scalars().unique().all()


advertisement_campaign_service = AdvertisementCampaignService()
