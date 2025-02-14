from typing import Annotated, Literal

from pydantic import UUID4, Field, HttpUrl, computed_field

from polar.config import settings
from polar.discount.schemas import DiscountMinimal
from polar.enums import PaymentProcessor
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import (
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
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

_allow_discount_codes_description = (
    "Whether to allow the customer to apply discount codes. "
    "If you apply a discount through `discount_id`, it'll still be applied, "
    "but the customer won't be able to change it."
)
_discount_id_description = (
    "ID of the discount to apply to the checkout. "
    "If the discount is not applicable anymore when opening the checkout link, "
    "it'll be ignored."
)


class CheckoutLinkCreateBase(MetadataInputMixin, Schema):
    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )
    label: str | None = Field(
        description="Optional label to distinguish links internally", default=None
    )
    allow_discount_codes: bool = Field(
        default=True, description=_allow_discount_codes_description
    )
    discount_id: UUID4 | None = Field(
        default=None, description=_discount_id_description
    )
    success_url: SuccessURL = None


class CheckoutLinkPriceCreate(CheckoutLinkCreateBase):
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")


class CheckoutLinkProductCreate(CheckoutLinkCreateBase):
    product_id: UUID4 = Field(
        description="ID of the product to checkout. First available price will be selected."
    )


CheckoutLinkCreate = Annotated[
    CheckoutLinkProductCreate | CheckoutLinkPriceCreate,
    SetSchemaReference("CheckoutLinkCreate"),
]


class CheckoutLinkUpdate(OptionalMetadataInputMixin):
    """Schema to update an existing checkout link."""

    label: str | None = None
    allow_discount_codes: bool | None = Field(
        default=None, description=_allow_discount_codes_description
    )
    product_price_id: UUID4 | None = None
    discount_id: UUID4 | None = Field(
        default=None, description=_discount_id_description
    )
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
    allow_discount_codes: bool = Field(description=_allow_discount_codes_description)
    product_id: UUID4 = Field(description="ID of the product to checkout.")
    product_price_id: UUID4 | None = Field(
        description="ID of the product price to checkout. First available price will be selected unless an explicit price ID is set."
    )
    discount_id: UUID4 | None = Field(description=_discount_id_description)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return settings.CHECKOUT_BASE_URL.format(client_secret=self.client_secret)


class CheckoutLinkProduct(ProductBase):
    """Product data for a checkout link."""

    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList


CheckoutLinkDiscount = Annotated[
    DiscountMinimal, MergeJSONSchema({"title": "CheckoutLinkDiscount"})
]


class CheckoutLink(CheckoutLinkBase):
    """Checkout link data."""

    product: CheckoutLinkProduct
    product_price: ProductPrice | None
    discount: CheckoutLinkDiscount | None
