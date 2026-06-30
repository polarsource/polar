import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.models import (
    PricingCompany,
    PricingMetric,
    PricingProduct,
    PricingSnapshot,
)
from tests.fixtures.database import SaveFixture


async def _seed_token_metric(
    save_fixture: SaveFixture, slug: str, name: str, amount: float
) -> None:
    company = PricingCompany(
        slug=slug,
        name=name,
        category="AI",
        summary=None,
        pricing_url=f"https://{slug}.test",
    )
    await save_fixture(company)
    product = PricingProduct(
        company=company,
        name="API",
        current_model="Usage",
        current_anchor=f"${amount} / M tokens",
        last_direction="new",
        last_change_at=utc_now(),
        last_content_hash="hash",
    )
    await save_fixture(product)
    metric = PricingMetric(
        product=product,
        label="Input tokens",
        unit="tokens",
        amount=amount,
        per_quantity=1_000_000,
        currency="USD",
        raw=f"${amount} / M tokens",
    )
    await save_fixture(metric)


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


@pytest.mark.asyncio
class TestCompare:
    async def test_orders_by_unit_price(
        self, client: AsyncClient, save_fixture: SaveFixture
    ) -> None:
        await _seed_token_metric(save_fixture, "pricey", "Pricey", 3.0)
        await _seed_token_metric(save_fixture, "cheap", "Cheap", 2.0)

        response = await client.get(
            "/v1/pricing-directory/compare", params={"unit": "tokens"}
        )

        assert response.status_code == 200
        rows = [
            r for r in response.json() if r["company"] in {"Pricey", "Cheap"}
        ]
        assert [r["company"] for r in rows] == ["Cheap", "Pricey"]
        assert rows[0]["unit_price"] == 2.0 / 1_000_000
