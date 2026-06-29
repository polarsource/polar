import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.models import PricingCompany, PricingProduct, PricingSnapshot
from tests.fixtures.database import SaveFixture


async def _seed(save_fixture: SaveFixture) -> PricingCompany:
    company = PricingCompany(
        slug="acme",
        name="Acme",
        category="AI",
        summary="A test company.",
        pricing_url="https://acme.test",
    )
    await save_fixture(company)
    product = PricingProduct(
        company=company,
        name="Pro",
        current_model="Seat",
        current_anchor="$20 / user / mo",
        last_direction="new",
        last_change_at=utc_now(),
        last_content_hash="hash",
    )
    await save_fixture(product)
    snapshot = PricingSnapshot(
        product=product,
        captured_at=utc_now(),
        model="Seat",
        anchor="$20 / user / mo",
        direction="new",
        confidence=0.9,
        source_excerpt=None,
    )
    await save_fixture(snapshot)
    return company


@pytest.mark.asyncio
class TestListCompanies:
    async def test_returns_companies_with_products(
        self, client: AsyncClient, save_fixture: SaveFixture
    ) -> None:
        await _seed(save_fixture)

        response = await client.get("/v1/pricing-directory/companies")

        assert response.status_code == 200
        acme = next(c for c in response.json() if c["slug"] == "acme")
        assert acme["products"][0]["name"] == "Pro"
        assert acme["products"][0]["current_anchor"] == "$20 / user / mo"


@pytest.mark.asyncio
class TestGetCompany:
    async def test_returns_detail_with_history(
        self, client: AsyncClient, save_fixture: SaveFixture
    ) -> None:
        await _seed(save_fixture)

        response = await client.get("/v1/pricing-directory/companies/acme")

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "acme"
        assert data["products"][0]["snapshots"][0]["anchor"] == "$20 / user / mo"

    async def test_unknown_slug_returns_404(self, client: AsyncClient) -> None:
        response = await client.get("/v1/pricing-directory/companies/nope")
        assert response.status_code == 404
