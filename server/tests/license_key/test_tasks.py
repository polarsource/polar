import uuid
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.service import BenefitGrantService
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreateProperties,
)
from polar.license_key.repository import LicenseKeyRepository
from polar.license_key.tasks import (
    LicenseKeyDoesNotExist,
    sync_benefit_grant,
)
from polar.models import BenefitGrant, Customer, LicenseKey, Organization, Product
from polar.models.license_key import LicenseKeyStatus
from polar.postgres import AsyncSession
from polar.redis import Redis
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


@pytest.fixture
def grant_benefit_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        benefit_grant_service, "grant_benefit", spec=BenefitGrantService.grant_benefit
    )


@pytest.fixture
def revoke_benefit_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        benefit_grant_service, "revoke_benefit", spec=BenefitGrantService.revoke_benefit
    )


@pytest.mark.asyncio
class TestSyncBenefitGrant:
    async def test_not_existing_license_key(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(LicenseKeyDoesNotExist):
            await sync_benefit_grant(uuid.uuid4())

    async def test_revoked_key_revokes_the_grant(
        self,
        grant_benefit_mock: AsyncMock,
        revoke_benefit_mock: AsyncMock,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, _ = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)

        session.expunge_all()

        await sync_benefit_grant(license_key.id)

        revoke_benefit_mock.assert_called_once()
        grant_benefit_mock.assert_not_called()

    @pytest.mark.parametrize(
        "status", [LicenseKeyStatus.granted, LicenseKeyStatus.disabled]
    )
    async def test_non_revoked_key_grants_the_grant(
        self,
        status: LicenseKeyStatus,
        grant_benefit_mock: AsyncMock,
        revoke_benefit_mock: AsyncMock,
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

        session.expunge_all()

        await sync_benefit_grant(license_key.id)

        grant_benefit_mock.assert_called_once()
        revoke_benefit_mock.assert_not_called()

    async def test_does_not_resurrect_a_key_revoked_after_enqueue(
        self,
        grant_benefit_mock: AsyncMock,
        revoke_benefit_mock: AsyncMock,
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
        grant.set_revoked()
        await save_fixture(grant)
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)

        session.expunge_all()

        await sync_benefit_grant(license_key.id)

        grant_benefit_mock.assert_not_called()
        revoke_benefit_mock.assert_not_called()

    async def test_grant_already_matching_the_key_is_left_alone(
        self,
        grant_benefit_mock: AsyncMock,
        revoke_benefit_mock: AsyncMock,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, _ = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )

        session.expunge_all()

        await sync_benefit_grant(license_key.id)

        grant_benefit_mock.assert_not_called()
        revoke_benefit_mock.assert_not_called()
