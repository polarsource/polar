from collections.abc import Sequence
from typing import cast

from polar.benefit.benefits.license_keys import BenefitLicenseKeysService
from polar.benefit.schemas import BenefitLicenseKeysCreateProperties
from polar.models import Benefit, LicenseKey, Organization, Product, User
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
        user: User,
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
            user=user,
            product=product,
        )

    @classmethod
    async def create_grant(
        cls,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        benefit: BenefitLicenseKeys,
        user: User,
        product: Product,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            user=user,
            status=SubscriptionStatus.active,
        )
        await create_benefit_grant(
            save_fixture,
            user,
            benefit,
            subscription=subscription,
        )
        return await cls.run_grant_task(session, redis, benefit, user)

    @classmethod
    async def run_grant_task(
        cls,
        session: AsyncSession,
        redis: Redis,
        benefit: BenefitLicenseKeys,
        user: User,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        service = BenefitLicenseKeysService(session, redis)
        granted = await service.grant(benefit, user, {})
        return benefit, granted

    @classmethod
    async def run_revoke_task(
        cls,
        session: AsyncSession,
        redis: Redis,
        benefit: BenefitLicenseKeys,
        user: User,
    ) -> tuple[BenefitLicenseKeys, BenefitGrantLicenseKeysProperties]:
        service = BenefitLicenseKeysService(session, redis)
        revoked = await service.revoke(benefit, user, {})
        return benefit, revoked

    @classmethod
    async def get_user_licenses(
        cls, session: AsyncSession, user: User
    ) -> Sequence[LicenseKey]:
        statement = (
            sql.select(LicenseKey)
            .join(Benefit)
            .where(
                LicenseKey.user_id == user.id,
                Benefit.deleted_at.is_(None),
            )
        )

        res = await session.execute(statement)
        licenses = res.scalars().all()
        return licenses
