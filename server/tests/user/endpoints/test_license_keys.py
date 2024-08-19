import pytest
from httpx import AsyncClient

from polar.benefit.schemas import BenefitLicenseKeysCreateProperties
from polar.kit.utils import generate_uuid
from polar.models import Organization, Product, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.license_key import TestLicenseKey


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestLicenseKeyEndpoints:

    async def test_get_non_existing_404s(
        self,
        session: AsyncSession,
        client: AsyncClient,
    ) -> None:
        random_id = generate_uuid()
        response = await client.get(f"/v1/users/license-keys/{random_id}")
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
        id = granted["license_key_id"]
        response = await client.get(f"/v1/users/license-keys/{id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("benefit_id") == str(benefit.id)
        assert data.get("key").startswith("TESTING")
