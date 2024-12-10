from collections.abc import Sequence
from typing import cast

from polar.benefit.benefits.license_keys import BenefitLicenseKeysService
from polar.benefit.schemas import BenefitLicenseKeysCreateProperties
from polar.models import Benefit, Customer, LicenseKey, Organization, Product
from polar.models.benefit import BenefitLicenseKeys, BenefitType
from polar.models.benefit_grant import BenefitGrantLicenseKeysProperties
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_subscription,
)


class TestLicenseKey:
    @classmethod
    async def create_benefit_and_grant(
        cls,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        properties: BenefitLicenseKeysCreateProperties,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.license_keys,
            organization=organization,
            properties=properties.model_dump(mode="json"),
        )
        return await cls.create_grant(
            session,
            redis,
            save_fixture,
            cast(BenefitLicenseKeys, benefit),
            customer=customer,
            product=product,
        )

    @classmethod
    async def create_grant(
        cls,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        benefit: BenefitLicenseKeys,
        customer: Customer,
        product: Product,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
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
        benefit: BenefitLicenseKeys,
        customer: Customer,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        service = BenefitLicenseKeysService(session, redis)
        granted = await service.grant(benefit, customer, {})
        return benefit, granted

    @classmethod
    async def run_revoke_task(
        cls,
        session: AsyncSession,
        redis: Redis,
        benefit: BenefitLicenseKeys,
        customer: Customer,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        service = BenefitLicenseKeysService(session, redis)
        revoked = await service.revoke(benefit, customer, {})
        return benefit, revoked

    @classmethod
    async def get_customer_licenses(
        cls, session: AsyncSession, customer: Customer
    ) -> Sequence[LicenseKey]:
        statement = (
            sql.select(LicenseKey)
            .join(Benefit)
            .where(
                LicenseKey.customer_id == customer.id,
                Benefit.deleted_at.is_(None),
            )
        )

        res = await session.execute(statement)
        licenses = res.scalars().all()
        return licenses
