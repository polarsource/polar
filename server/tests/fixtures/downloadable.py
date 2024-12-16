from collections.abc import Sequence
from typing import cast

from sqlalchemy.orm import contains_eager

from polar.benefit.benefits.downloadables import BenefitDownloadablesService
from polar.benefit.schemas import BenefitDownloadablesCreateProperties
from polar.models import Benefit, Customer, Downloadable, File, Organization, Product
from polar.models.benefit import BenefitDownloadables, BenefitType
from polar.models.benefit_grant import BenefitGrantDownloadablesProperties
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_subscription,
)


class TestDownloadable:
    @classmethod
    async def create_benefit_and_grant(
        cls,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        properties: BenefitDownloadablesCreateProperties,
    ) -> tuple[BenefitDownloadables, BenefitGrantDownloadablesProperties]:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.downloadables,
            organization=organization,
            properties=properties.model_dump(mode="json"),
        )
        return await cls.create_grant(
            session,
            redis,
            save_fixture,
            cast(BenefitDownloadables, benefit),
            customer=customer,
            product=product,
        )

    @classmethod
    async def create_grant(
        cls,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        benefit: BenefitDownloadables,
        customer: Customer,
        product: Product,
    ) -> tuple[BenefitDownloadables, BenefitGrantDownloadablesProperties]:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            subscription=subscription,
        )
        return await cls.run_grant_task(session, redis, benefit, customer)

    @classmethod
    async def run_grant_task(
        cls,
        session: AsyncSession,
        redis: Redis,
        benefit: BenefitDownloadables,
        customer: Customer,
    ) -> tuple[BenefitDownloadables, BenefitGrantDownloadablesProperties]:
        service = BenefitDownloadablesService(session, redis)
        granted = await service.grant(benefit, customer, {})
        return benefit, granted

    @classmethod
    async def run_revoke_task(
        cls,
        session: AsyncSession,
        redis: Redis,
        benefit: BenefitDownloadables,
        customer: Customer,
    ) -> tuple[BenefitDownloadables, BenefitGrantDownloadablesProperties]:
        service = BenefitDownloadablesService(session, redis)
        revoked = await service.revoke(benefit, customer, {})
        return benefit, revoked

    @classmethod
    async def get_customer_downloadables(
        cls, session: AsyncSession, customer: Customer
    ) -> Sequence[Downloadable]:
        statement = (
            sql.select(Downloadable)
            .join(File)
            .join(Benefit)
            .options(contains_eager(Downloadable.file))
            .where(
                Downloadable.customer_id == customer.id,
                File.deleted_at.is_(None),
                File.is_uploaded == True,  # noqa
                File.is_enabled == True,  # noqa
                Benefit.deleted_at.is_(None),
            )
        )

        res = await session.execute(statement)
        downloadables = res.scalars().all()
        return downloadables
