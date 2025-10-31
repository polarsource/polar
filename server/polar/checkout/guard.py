from typing import TYPE_CHECKING, TypeIs
from uuid import UUID

from polar.models import Checkout, Product, ProductPrice

if TYPE_CHECKING:

    class ProductCheckout(Checkout):
        product_id: UUID
        product: Product
        product_price_id: UUID
        product_price: ProductPrice
else:
    ProductCheckout = Checkout


def has_product_checkout(checkout: Checkout) -> TypeIs[ProductCheckout]:
    return checkout.product is not None and checkout.product_price is not None
