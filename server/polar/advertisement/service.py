import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import UUID, Select, UnaryExpression, asc, desc, select, update

from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import AdvertisementCampaign, Benefit, BenefitGrant


class SortProperty(StrEnum):
    created_at = "created_at"
    granted_at = "granted_at"
    views = "views"
    clicks = "clicks"


class AdvertisementCampaignService(ResourceServiceReader[AdvertisementCampaign]):
    async def list(
        self,
        session: AsyncSession,
        *,
        benefit_id: uuid.UUID,
        pagination: PaginationParams,
        sorting: list[Sorting[SortProperty]] = [(SortProperty.granted_at, False)],
    ) -> tuple[Sequence[AdvertisementCampaign], int]:
        statement = self._get_readable_advertisement_statement().where(
            Benefit.id == benefit_id
        )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SortProperty.created_at:
                order_by_clauses.append(
                    clause_function(AdvertisementCampaign.created_at)
                )
            elif criterion == SortProperty.granted_at:
                order_by_clauses.append(clause_function(BenefitGrant.granted_at))
            elif criterion == SortProperty.views:
                order_by_clauses.append(clause_function(AdvertisementCampaign.views))
            elif criterion == SortProperty.clicks:
                order_by_clauses.append(clause_function(AdvertisementCampaign.clicks))
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_id(
        self, session: AsyncSession, id: uuid.UUID
    ) -> AdvertisementCampaign | None:
        statement = self._get_readable_advertisement_statement().where(
            AdvertisementCampaign.id == id
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def track_view(
        self,
        session: AsyncSession,
        advertisement_campaign: AdvertisementCampaign,
    ) -> AdvertisementCampaign:
        statement = (
            update(AdvertisementCampaign)
            .where(AdvertisementCampaign.id == advertisement_campaign.id)
            .values({"views": AdvertisementCampaign.views + 1})
            .returning(AdvertisementCampaign)
        )

        result = await session.execute(statement)

        return result.scalar_one()

    def _get_readable_advertisement_statement(
        self,
    ) -> Select[tuple[AdvertisementCampaign]]:
        return (
            select(AdvertisementCampaign)
            # Join with the latest benefit grant
            .join(
                BenefitGrant,
                onclause=BenefitGrant.id
                == select(BenefitGrant)
                .correlate(AdvertisementCampaign)
                .with_only_columns(BenefitGrant.id)
                .where(
                    BenefitGrant.deleted_at.is_(None),
                    BenefitGrant.is_granted.is_(True),
                    AdvertisementCampaign.id
                    == BenefitGrant.properties["advertisement_campaign_id"].astext.cast(
                        UUID
                    ),
                )
                .order_by(BenefitGrant.granted_at.desc())
                .limit(1)
                .scalar_subquery(),
            )
            .join(Benefit, onclause=Benefit.id == BenefitGrant.benefit_id)
            .where(AdvertisementCampaign.deleted_at.is_(None))
        )


advertisement_campaign = AdvertisementCampaignService(AdvertisementCampaign)
