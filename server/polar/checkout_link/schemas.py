from typing import Annotated, Literal

from pydantic import UUID4, AliasPath, Field, HttpUrl, computed_field
from pydantic.json_schema import SkipJsonSchema

from polar.config import settings
from polar.discount.schemas import DiscountMinimal
from polar.enums import PaymentProcessor
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.kit.trial import TrialConfigurationInputMixin, TrialConfigurationOutputMixin
from polar.organization.schemas import OrganizationID
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
_require_billing_address_description = (
    "Whether to require the customer to fill their full billing address, instead of "
    "just the country. "
    "Customers in the US will always be required to fill their full address, "
    "regardless of this setting."
)
_discount_id_description = (
    "ID of the discount to apply to the checkout. "
    "If the discount is not applicable anymore when opening the checkout link, "
    "it'll be ignored."
)


class CheckoutLinkCreateBase(TrialConfigurationInputMixin, MetadataInputMixin, Schema):
    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )
    label: str | None = Field(
        description="Optional label to distinguish links internally", default=None
    )
    allow_discount_codes: bool = Field(
        default=True, description=_allow_discount_codes_description
    )
    require_billing_address: bool = Field(
        default=False, description=_require_billing_address_description
    )
    discount_id: UUID4 | None = Field(
        default=None, description=_discount_id_description
    )
    success_url: SuccessURL = None


class CheckoutLinkCreateProductPrice(CheckoutLinkCreateBase):
    """
    Schema to create a new checkout link from a a single product price.

    **Deprecated**: Use `CheckoutLinkCreateProducts` instead.
    """

    product_price_id: UUID4


class CheckoutLinkCreateProduct(CheckoutLinkCreateBase):
    """
    Schema to create a new checkout link from a a single product.

    **Deprecated**: Use `CheckoutLinkCreateProducts` instead.
    """

    product_id: UUID4


class CheckoutLinkCreateProducts(CheckoutLinkCreateBase):
    """Schema to create a new checkout link."""

    products: list[UUID4] = Field(
        description="List of products that will be available to select at checkout.",
        min_length=1,
    )


CheckoutLinkCreate = Annotated[
    CheckoutLinkCreateProductPrice
    | CheckoutLinkCreateProduct
    | CheckoutLinkCreateProducts,
    SetSchemaReference("CheckoutLinkCreate"),
]


class CheckoutLinkUpdate(MetadataInputMixin, TrialConfigurationInputMixin):
    """Schema to update an existing checkout link."""

    products: list[UUID4] | None = Field(
        default=None,
        description="List of products that will be available to select at checkout.",
        min_length=1,
    )
    label: str | None = None
    allow_discount_codes: bool | None = Field(
        default=None, description=_allow_discount_codes_description
    )
    require_billing_address: bool | None = Field(
        default=None, description=_require_billing_address_description
    )
    discount_id: UUID4 | None = Field(
        default=None, description=_discount_id_description
    )
    success_url: SuccessURL = None


class CheckoutLinkBase(
    MetadataOutputMixin, TrialConfigurationOutputMixin, TimestampedSchema, IDSchema
):
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
    require_billing_address: bool = Field(
        description=_require_billing_address_description
    )
    discount_id: UUID4 | None = Field(description=_discount_id_description)
    organization_id: OrganizationID

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return settings.CHECKOUT_BASE_URL.format(client_secret=self.client_secret)


class CheckoutLinkProduct(ProductBase, MetadataOutputMixin):
    """Product data for a checkout link."""

    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList


CheckoutLinkDiscount = Annotated[
    DiscountMinimal, MergeJSONSchema({"title": "CheckoutLinkDiscount"})
]


class CheckoutLink(CheckoutLinkBase):
    """Checkout link data."""

    products: list[CheckoutLinkProduct]
    discount: CheckoutLinkDiscount | None

    # Deprecated fields for backward compatibility
    product_id: SkipJsonSchema[UUID4] = Field(
        validation_alias=AliasPath("products", 0, "id"),
        deprecated="Use `products` instead.",
    )
    product_price_id: SkipJsonSchema[UUID4] = Field(
        validation_alias=AliasPath("products", 0, "prices", 0, "id"),
        deprecated="Use `products` instead.",
    )
    product: SkipJsonSchema[CheckoutLinkProduct] = Field(
        validation_alias=AliasPath("products", 0),
        deprecated="Use `products` instead.",
    )
    product_price: SkipJsonSchema[ProductPrice] = Field(
        validation_alias=AliasPath("products", 0, "prices", 0),
        deprecated="Use `products` instead.",
    )
