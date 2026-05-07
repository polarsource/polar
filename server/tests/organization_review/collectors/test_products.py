from unittest.mock import MagicMock

from polar.models.product_price import ProductPriceAmountType
from polar.organization_review.collectors.products import collect_products_data


def _build_price(
    amount_type: ProductPriceAmountType,
    *,
    price_amount: int | None = None,
    price_currency: str | None = "usd",
) -> MagicMock:
    """Build a mock ProductPrice. Only attributes used by the collector are set."""
    price = MagicMock(spec=["amount_type", "price_amount", "price_currency"])
    price.amount_type = amount_type
    price.price_amount = price_amount
    price.price_currency = price_currency
    return price


def _build_product(
    *,
    name: str = "Product",
    is_archived: bool = False,
    prices: list[MagicMock] | None = None,
) -> MagicMock:
    product = MagicMock()
    product.name = name
    product.description = None
    product.recurring_interval = None
    product.visibility = None
    product.is_archived = is_archived
    product.prices = prices or []
    return product


class TestCollectProductsData:
    def test_empty(self) -> None:
        data = collect_products_data([])
        assert data.total_count == 0
        assert data.adhoc_prices_count == 0
        assert data.custom_pricing_products_count == 0

    def test_passes_through_adhoc_prices_count(self) -> None:
        data = collect_products_data([], adhoc_prices_count=7)
        assert data.adhoc_prices_count == 7

    def test_counts_products_with_pay_what_you_want_pricing(self) -> None:
        custom_product = _build_product(
            name="Donate",
            prices=[_build_price(ProductPriceAmountType.custom)],
        )
        fixed_product = _build_product(
            name="Pro Plan",
            prices=[_build_price(ProductPriceAmountType.fixed, price_amount=2000)],
        )
        data = collect_products_data([custom_product, fixed_product])
        assert data.total_count == 2
        assert data.custom_pricing_products_count == 1

    def test_counts_each_custom_product_once_regardless_of_price_count(self) -> None:
        product = _build_product(
            prices=[
                _build_price(ProductPriceAmountType.custom),
                _build_price(ProductPriceAmountType.custom),
                _build_price(ProductPriceAmountType.fixed, price_amount=500),
            ],
        )
        data = collect_products_data([product])
        assert data.custom_pricing_products_count == 1

    def test_no_custom_pricing(self) -> None:
        data = collect_products_data(
            [
                _build_product(
                    prices=[
                        _build_price(ProductPriceAmountType.fixed, price_amount=1000)
                    ],
                ),
                _build_product(prices=[_build_price(ProductPriceAmountType.free)]),
            ]
        )
        assert data.custom_pricing_products_count == 0
