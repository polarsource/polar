from typing import Annotated, Literal

from pydantic import UUID4, Field, HttpUrl, computed_field

from polar.config import settings
from polar.enums import PaymentProcessor
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.product.schemas import ProductPrice

SuccessURL = Annotated[
    HttpUrl | None,
    Field(
        description=(
            "URL where the customer will be redirected after a successful payment."
            "You can add the `checkout_id={CHECKOUT_ID}` query parameter "
            "to retrieve the checkout session id."
        )
    ),
]


class CheckoutLinkCreate(MetadataInputMixin, Schema):
    """Schema to create a new checkout link."""

    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")
    success_url: SuccessURL = None


class CheckoutLinkUpdate(OptionalMetadataInputMixin):
    """Schema to update an existing checkout link."""

    success_url: SuccessURL = None


class CheckoutLinkBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    payment_processor: PaymentProcessor = Field(description="Payment processor used.")
    client_secret: str = Field(
        description="Client secret used to access the checkout link."
    )
    success_url: str | None = Field(
        description=(
            "URL where the customer will be redirected after a successful payment."
        )
    )
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return settings.CHECKOUT_BASE_URL.format(client_secret=self.client_secret)


class CheckoutLink(CheckoutLinkBase):
    """Checkout link data."""

    product_price: ProductPrice
