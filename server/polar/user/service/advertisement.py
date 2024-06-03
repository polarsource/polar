import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select, update

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import AdvertisementCampaign, BenefitGrant, User
from polar.models.benefit import BenefitType

from ..schemas.advertisement import (
    UserAdvertisementCampaignCreate,
    UserAdvertisementCampaignEnable,
    UserAdvertisementCampaignUpdate,
)
from .benefit import user_benefit as user_benefit_service


class UserAdvertisementError(PolarError): ...


class SortProperty(StrEnum):
    created_at = "created_at"
    views = "views"
    clicks = "clicks"


class UserAdvertisementService(ResourceServiceReader[AdvertisementCampaign]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        pagination: PaginationParams,
        sorting: list[Sorting[SortProperty]] = [(SortProperty.created_at, True)],
    ) -> tuple[Sequence[AdvertisementCampaign], int]:
        statement = self._get_readable_advertisement_statement(auth_subject)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SortProperty.created_at:
                order_by_clauses.append(
                    clause_function(AdvertisementCampaign.created_at)
                )
            elif criterion == SortProperty.views:
                order_by_clauses.append(clause_function(AdvertisementCampaign.views))
            elif criterion == SortProperty.clicks:
                order_by_clauses.append(clause_function(AdvertisementCampaign.clicks))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        id: uuid.UUID,
    ) -> AdvertisementCampaign | None:
        statement = self._get_readable_advertisement_statement(auth_subject).where(
            AdvertisementCampaign.id == id
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        advertisement_campaign_create: UserAdvertisementCampaignCreate,
    ) -> AdvertisementCampaign:
        advertisement_campaign = AdvertisementCampaign(
            user=auth_subject.subject, **advertisement_campaign_create.model_dump()
        )
        session.add(advertisement_campaign)
        await session.flush()

        return advertisement_campaign

    async def update(
        self,
        session: AsyncSession,
        *,
        advertisement_campaign: AdvertisementCampaign,
        advertisement_campaign_update: UserAdvertisementCampaignUpdate,
    ) -> AdvertisementCampaign:
        for attr, value in advertisement_campaign_update.model_dump(
            exclude_unset=True
        ).items():
            setattr(advertisement_campaign, attr, value)

        session.add(advertisement_campaign)

        return advertisement_campaign

    async def enable(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        advertisement_campaign: AdvertisementCampaign,
        advertisement_campaign_enable: UserAdvertisementCampaignEnable,
    ) -> Sequence[BenefitGrant]:
        benefit = await user_benefit_service.get_by_id(
            session, auth_subject, advertisement_campaign_enable.benefit_id
        )

        if benefit is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": "Benefit does not exist or is not granted.",
                        "loc": ("body", "benefit_id"),
                        "input": advertisement_campaign_enable.benefit_id,
                    }
                ]
            )

        if benefit.type != BenefitType.ads:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": "Not an advertisement benefit.",
                        "loc": ("body", "benefit_id"),
                        "input": advertisement_campaign_enable.benefit_id,
                    }
                ]
            )

        updated_grants: list[BenefitGrant] = []
        for grant in benefit.grants:
            # Those are guaranteed by the query in get_by_id, but let's be explicit
            assert grant.user_id == auth_subject.subject.id
            assert grant.is_granted

            grant.properties["advertisement_campaign_id"] = str(
                advertisement_campaign.id
            )
            session.add(grant)
            updated_grants.append(grant)

        return updated_grants

    async def delete(
        self, session: AsyncSession, *, advertisement_campaign: AdvertisementCampaign
    ) -> AdvertisementCampaign:
        advertisement_campaign.set_deleted_at()
        session.add(advertisement_campaign)

        statement = (
            update(BenefitGrant)
            .where(
                BenefitGrant.properties["advertisement_campaign_id"].astext
                == str(advertisement_campaign.id),
            )
            .values(properties={})
        )
        await session.execute(statement)

        return advertisement_campaign

    def _get_readable_advertisement_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[AdvertisementCampaign]]:
        statement = select(AdvertisementCampaign).where(
            AdvertisementCampaign.deleted_at.is_(None),
            AdvertisementCampaign.user_id == auth_subject.subject.id,
        )
        return statement


user_advertisement = UserAdvertisementService(AdvertisementCampaign)
