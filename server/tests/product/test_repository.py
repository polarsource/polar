import pytest

from polar.kit.currency import PresentmentCurrency
from polar.models import Organization
from polar.models.product_price import ProductPriceSource
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product, create_product_price_fixed


@pytest.mark.asyncio
class TestGetProductsWithoutCurrency:
    async def test_returns_product_without_currency(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Product with only USD catalog price is returned when looking for EUR."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(1000, "usd")],
        )

        repository = ProductRepository(session)
        results = await repository.get_products_without_currency(
            organization.id, PresentmentCurrency.eur
        )

        assert len(results) == 1
        assert results[0].id == product.id

    async def test_does_not_return_product_with_catalog_currency(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Product with a catalog EUR price is NOT returned when looking for EUR."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(1000, "usd"), (900, "eur")],
        )

        repository = ProductRepository(session)
        results = await repository.get_products_without_currency(
            organization.id, PresentmentCurrency.eur
        )

        assert len(results) == 0

    async def test_ad_hoc_price_does_not_count(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """
        A product with only an ad_hoc EUR price (no catalog EUR price) IS returned
        when looking for products without EUR — i.e., ad_hoc prices are excluded.
        """
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(1000, "usd")],  # Only USD catalog price
        )

        # Add an ad_hoc EUR price (as would be created for a checkout session)
        ad_hoc_price = await create_product_price_fixed(
            save_fixture,
            product=product,
            amount=900,
            currency="eur",
        )
        # Mutate the source to ad_hoc after creation (default is catalog)
        ad_hoc_price.source = ProductPriceSource.ad_hoc
        await save_fixture(ad_hoc_price)

        repository = ProductRepository(session)
        results = await repository.get_products_without_currency(
            organization.id, PresentmentCurrency.eur
        )

        # Product should be returned because it has NO catalog EUR price,
        # only an ad_hoc price (which must not be counted)
        assert len(results) == 1
        assert results[0].id == product.id
