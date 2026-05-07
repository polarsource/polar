from polar.models.product import Product
from polar.models.product_price import ProductPriceAmountType

from ..schemas import ProductData, ProductsData


def collect_products_data(
    products: list[Product], adhoc_prices_count: int = 0
) -> ProductsData:
    product_data_list = []
    custom_pricing_products_count = 0
    for product in products:
        prices = []
        for price in product.prices:
            price_info: dict[str, str | int] = {
                "amount_type": str(price.amount_type),
            }
            if hasattr(price, "price_amount") and price.price_amount is not None:
                price_info["amount_cents"] = price.price_amount
            if hasattr(price, "price_currency"):
                price_info["currency"] = price.price_currency
            prices.append(price_info)

        if any(p.amount_type == ProductPriceAmountType.custom for p in product.prices):
            custom_pricing_products_count += 1

        product_data_list.append(
            ProductData(
                name=product.name,
                description=product.description,
                billing_type=product.recurring_interval.value
                if product.recurring_interval
                else "one_time",
                visibility=product.visibility.value if product.visibility else None,
                is_archived=product.is_archived,
                prices=prices,
            )
        )

    return ProductsData(
        products=product_data_list,
        total_count=len(product_data_list),
        adhoc_prices_count=adhoc_prices_count,
        custom_pricing_products_count=custom_pricing_products_count,
    )
