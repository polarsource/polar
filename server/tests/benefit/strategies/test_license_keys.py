from typing import cast
from uuid import UUID

import pytest
from dateutil.relativedelta import relativedelta

from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.strategies.license_keys.properties import (
    BenefitGrantLicenseKeysProperties,
)
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeyExpirationProperties,
    BenefitLicenseKeysCreateProperties,
)
from polar.kit.utils import utc_now
from polar.license_key.repository import LicenseKeyRepository
from polar.models import BenefitGrant, Customer, LicenseKey, Organization, Product
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_order,
    create_subscription,
)

EXPIRING_PROPERTIES = BenefitLicenseKeysCreateProperties(
    prefix="testing",
    expires=BenefitLicenseKeyExpirationProperties(ttl=1, timeframe="year"),
).model_dump(mode="json")


async def _get_license_key(session: AsyncSession, grant: BenefitGrant) -> LicenseKey:
    properties = cast(BenefitGrantLicenseKeysProperties, grant.properties)
    repository = LicenseKeyRepository.from_session(session)
    license_key = await repository.get_by_id(UUID(properties["license_key_id"]))
    assert license_key is not None
    return license_key


@pytest.mark.asyncio
class TestGrantExpiration:
    async def test_subscription_grant_never_sets_expiration(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.license_keys,
            organization=organization,
            properties=EXPIRING_PROPERTIES,
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, subscription=subscription
        )

        license_key = await _get_license_key(session, grant)
        assert license_key.expires_at is None

    async def test_order_grant_sets_expiration(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.license_keys,
            organization=organization,
            properties=EXPIRING_PROPERTIES,
        )
        order = await create_order(save_fixture, customer=customer, product=product)

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, order=order
        )

        license_key = await _get_license_key(session, grant)
        assert license_key.expires_at is not None

    async def test_update_subscription_grant_unsets_expiration(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.license_keys,
            organization=organization,
            properties=EXPIRING_PROPERTIES,
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, subscription=subscription
        )

        license_key = await _get_license_key(session, grant)
        # Simulate a key granted with an expiration before the rule was introduced.
        license_key.expires_at = utc_now() + relativedelta(days=30)
        session.add(license_key)
        await session.flush()

        loaded_grant = await benefit_grant_service.get(session, grant.id, loaded=True)
        assert loaded_grant is not None
        await benefit_grant_service.update_benefit_grant(session, redis, loaded_grant)

        license_key = await _get_license_key(session, grant)
        assert license_key.expires_at is None
