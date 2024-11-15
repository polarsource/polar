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
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)

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


class CheckoutLinkCreateBase(MetadataInputMixin, Schema):
    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )
    label: str | None = Field(
        description="Optional label to distinguish links internally", default=None
    )
    success_url: SuccessURL = None


class CheckoutLinkPriceCreate(CheckoutLinkCreateBase):
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")


class CheckoutLinkProductCreate(CheckoutLinkCreateBase):
    product_id: UUID4 = Field(
        description="ID of the product to checkout. First available price will be selected."
    )


CheckoutLinkCreate = CheckoutLinkProductCreate | CheckoutLinkPriceCreate


class CheckoutLinkUpdate(OptionalMetadataInputMixin):
    """Schema to update an existing checkout link."""

    label: str | None = None
    product_price_id: UUID4 | None = None
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
    label: str | None = Field(
        description="Optional label to distinguish links internally"
    )
    product_id: UUID4 = Field(description="ID of the product to checkout.")
    product_price_id: UUID4 | None = Field(
        description="ID of the product price to checkout. First available price will be selected unless an explicit price ID is set."
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return settings.CHECKOUT_BASE_URL.format(client_secret=self.client_secret)


class CheckoutLinkProduct(ProductBase):
    """Product data for a checkout link."""

    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList


class CheckoutLink(CheckoutLinkBase):
    """Checkout link data."""

    product: CheckoutLinkProduct
    product_price: ProductPrice | None
