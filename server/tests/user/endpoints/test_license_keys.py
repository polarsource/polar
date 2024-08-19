import pytest
from httpx import AsyncClient

from polar.benefit.schemas import BenefitLicenseKeysCreateProperties
from polar.models import Organization, Product, User
from polar.postgres import AsyncSession
from polar.user.service.license_key import license_key as license_key_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.license_key import TestLicenseKey


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestLicenseKeyEndpoints:

    async def test_wrong_key_404s(
        self,
        session: AsyncSession,
        client: AsyncClient,
    ) -> None:
        response = await client.get("/v1/users/license-keys/foobar-123")
        assert response.status_code == 404

    async def test_get(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=None,
            ),
        )
        lk_id = granted["license_key_id"]
        lk = await license_key_service.get(session, lk_id)
        assert lk
        key = lk.key
        assert key
        response = await client.get(f"/v1/users/license-keys/{key}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("benefit_id") == str(benefit.id)
