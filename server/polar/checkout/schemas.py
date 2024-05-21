from pydantic import UUID4, AnyHttpUrl, Field

from polar.kit.schemas import EmailStrDNS, Schema
from polar.product.schemas import Product, ProductPrice


class CheckoutCreate(Schema):
    product_price_id: UUID4 = Field(
        ...,
        description="ID of the product price to subscribe to.",
    )
    success_url: AnyHttpUrl = Field(
        ...,
        description=(
            "URL where the customer will be redirected after a successful subscription. "
            "You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter "
            "to retrieve the checkout session id."
        ),
    )
    customer_email: EmailStrDNS | None = Field(
        None,
        description=(
            "If you already know the email of your customer, you can set it. "
            "It'll be pre-filled on the checkout page."
        ),
    )


class Checkout(Schema):
    """A checkout session."""

    id: str = Field(..., description="The ID of the checkout.")
    url: str | None = Field(
        None,
        description="URL the customer should be redirected to complete the purchase.",
    )
    customer_email: str | None = None
    customer_name: str | None = None
    product: Product
    product_price: ProductPrice
