from uuid import UUID

import pytest

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreateProperties,
)
from polar.kit.db.postgres import AsyncSession
from polar.license_key.repository import LicenseKeyRepository
from polar.models import BenefitGrant, Customer, LicenseKey, Organization, Product
from polar.models.license_key import LicenseKeyStatus
from polar.redis import Redis
from scripts.backfill_license_key_grant_state import (
    diverged_count_statement,
    realign_statement,
)
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.license_key import TestLicenseKey


async def _license_key_and_grant(
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    product: Product,
) -> tuple[LicenseKey, BenefitGrant]:
    benefit, granted = await TestLicenseKey.create_benefit_and_grant(
        session,
        redis,
        save_fixture,
        customer=customer,
        organization=organization,
        product=product,
        properties=BenefitLicenseKeysCreateProperties(prefix="testing"),
    )
    license_key_repository = LicenseKeyRepository.from_session(session)
    license_key = await license_key_repository.get_by_id(
        UUID(granted["license_key_id"])
    )
    assert license_key is not None

    grant_repository = BenefitGrantRepository.from_session(session)
    grant = await grant_repository.get_by_property_and_organization(
        organization.id,
        "license_key_id",
        str(license_key.id),
        benefit_id=benefit.id,
    )
    assert grant is not None
    return license_key, grant


async def _realign(session: AsyncSession, *, revoke: bool) -> int:
    return await run_batched_update(
        realign_statement(revoke=revoke),
        batch_size=5000,
        sleep_seconds=0,
        session=session,
    )


async def _count(session: AsyncSession, *, revoke: bool) -> int:
    result = await session.execute(diverged_count_statement(revoke=revoke))
    return result.scalar_one()


@pytest.mark.asyncio
class TestBackfillLicenseKeyGrantState:
    async def test_revoked_key_revokes_the_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)

        assert await _count(session, revoke=True) == 1
        assert await _realign(session, revoke=True) == 1

        await session.refresh(grant)
        assert grant.is_revoked is True
        assert grant.is_granted is False

    @pytest.mark.parametrize(
        "status", [LicenseKeyStatus.granted, LicenseKeyStatus.disabled]
    )
    async def test_non_revoked_key_grants_the_grant(
        self,
        status: LicenseKeyStatus,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = status
        await save_fixture(license_key)
        grant.set_revoked()
        await save_fixture(grant)

        assert await _count(session, revoke=False) == 1
        assert await _realign(session, revoke=False) == 1

        await session.refresh(grant)
        assert grant.is_granted is True
        assert grant.is_revoked is False

    @pytest.mark.parametrize(
        "status", [LicenseKeyStatus.granted, LicenseKeyStatus.disabled]
    )
    async def test_aligned_grant_is_left_alone(
        self,
        status: LicenseKeyStatus,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = status
        await save_fixture(license_key)
        granted_at = grant.granted_at

        assert await _count(session, revoke=True) == 0
        assert await _count(session, revoke=False) == 0
        assert await _realign(session, revoke=True) == 0
        assert await _realign(session, revoke=False) == 0

        await session.refresh(grant)
        assert grant.granted_at == granted_at

    async def test_pending_grant_is_left_alone(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)
        grant.granted_at = None
        grant.revoked_at = None
        await save_fixture(grant)

        assert await _count(session, revoke=True) == 0
        assert await _realign(session, revoke=True) == 0

        await session.refresh(grant)
        assert grant.granted_at is None
        assert grant.revoked_at is None

    async def test_soft_deleted_grant_is_left_alone(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)
        grant.set_deleted_at()
        await save_fixture(grant)

        assert await _count(session, revoke=True) == 0
        assert await _realign(session, revoke=True) == 0
