from datetime import datetime
from typing import Annotated, Any, Literal, Self

from annotated_types import Ge, Le
from pydantic import (
    UUID4,
    AliasChoices,
    Discriminator,
    Field,
    HttpUrl,
    IPvAnyAddress,
    Tag,
    computed_field,
)
from pydantic.json_schema import SkipJsonSchema

from polar.custom_field.attachment import AttachedCustomField
from polar.custom_field.data import (
    CustomFieldDataInputMixin,
    CustomFieldDataOutputMixin,
)
from polar.discount.schemas import (
    DiscountFixedBase,
    DiscountOnceForeverDurationBase,
    DiscountPercentageBase,
    DiscountRepeatDurationBase,
)
from polar.enums import PaymentProcessor
from polar.kit.address import Address
from polar.kit.metadata import (
    METADATA_DESCRIPTION,
    MetadataField,
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    EmailStrDNS,
    EmptyStrToNoneValidator,
    IDSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.organization.schemas import Organization
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999
MINIMUM_PRICE_AMOUNT = 50

Amount = Annotated[
    int,
    Field(
        description=(
            "Amount in cents, before discounts and taxes. "
            "Only useful for custom prices, it'll be ignored for fixed and free prices."
        )
    ),
    Ge(MINIMUM_PRICE_AMOUNT),
    Le(MAXIMUM_PRICE_AMOUNT),
]
CustomerName = Annotated[
    str,
    Field(description="Name of the customer."),
]
CustomerEmail = Annotated[
    EmailStrDNS,
    Field(description="Email address of the customer."),
]
CustomerIPAddress = Annotated[
    IPvAnyAddress,
    Field(
        description="IP address of the customer. Used to detect tax location.",
    ),
]
CustomerBillingAddress = Annotated[
    Address,
    Field(description="Billing address of the customer."),
]
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
EmbedOrigin = Annotated[
    str | None,
    Field(
        default=None,
        description="If you plan to embed the checkout session, "
        "set this to the Origin of the embedding page. "
        "It'll allow the Polar iframe to communicate with the parent page.",
    ),
]

_external_customer_id_description = (
    "ID of the customer in your system. "
    "If a matching customer exists on Polar, the resulting order "
    "will be linked to this customer. "
    "Otherwise, a new customer will be created with this external ID set."
)
_allow_discount_codes_description = (
    "Whether to allow the customer to apply discount codes. "
    "If you apply a discount through `discount_id`, it'll still be applied, "
    "but the customer won't be able to change it."
)
_require_billing_address_description = (
    "Whether to require the customer to fill their full billing address, instead of "
    "just the country. "
    "Customers in the US will always be required to fill their full address, "
    "regardless of this setting. "
    "If you preset the billing address, this setting will be automatically set to "
    "`true`."
)
_customer_metadata_description = METADATA_DESCRIPTION.format(
    heading=(
        "Key-value object allowing you to store additional information "
        "that'll be copied to the created customer."
    )
)


class CheckoutCreateBase(CustomFieldDataInputMixin, MetadataInputMixin, Schema):
    """
    Create a new checkout session.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    discount_id: UUID4 | None = Field(
        default=None, description="ID of the discount to apply to the checkout."
    )
    allow_discount_codes: bool = Field(
        default=True, description=_allow_discount_codes_description
    )
    require_billing_address: bool = Field(
        default=False, description=_require_billing_address_description
    )
    amount: Amount | None = None
    customer_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of an existing customer in the organization. "
            "The customer data will be pre-filled in the checkout form. "
            "The resulting order will be linked to this customer."
        ),
    )
    customer_external_id: str | None = Field(
        default=None, description=_external_customer_id_description
    )
    customer_name: Annotated[CustomerName | None, EmptyStrToNoneValidator] = None
    customer_email: CustomerEmail | None = None
    customer_ip_address: CustomerIPAddress | None = None
    customer_billing_address: CustomerBillingAddress | None = None
    customer_tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None
    customer_metadata: MetadataField = Field(
        default_factory=dict, description=_customer_metadata_description
    )
    subscription_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of a subscription to upgrade. It must be on a free pricing. "
            "If checkout is successful, metadata set on this checkout "
            "will be copied to the subscription, and existing keys will be overwritten."
        ),
    )
    success_url: SuccessURL = None
    embed_origin: EmbedOrigin = None


class CheckoutPriceCreate(CheckoutCreateBase):
    """
    Create a new checkout session from a product price.

    **Deprecated**: Use `CheckoutProductsCreate` instead.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")


class CheckoutProductCreate(CheckoutCreateBase):
    """
    Create a new checkout session from a product.

    **Deprecated**: Use `CheckoutProductsCreate` instead.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    product_id: UUID4 = Field(
        description=(
            "ID of the product to checkout. First available price will be selected."
        )
    )


class CheckoutProductsCreate(CheckoutCreateBase):
    """
    Create a new checkout session from a list of products.
    Customers will be able to switch between those products.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    products: list[UUID4] = Field(
        description=(
            "List of product IDs available to select at that checkout. "
            "The first one will be selected by default."
        ),
        min_length=1,
    )


CheckoutCreate = Annotated[
    CheckoutProductsCreate
    | SkipJsonSchema[CheckoutProductCreate]
    | SkipJsonSchema[CheckoutPriceCreate],
    SetSchemaReference("CheckoutCreate"),
]


class CheckoutCreatePublic(Schema):
    """Create a new checkout session from a client."""

    product_id: UUID4 = Field(description="ID of the product to checkout.")
    customer_email: CustomerEmail | None = None
    subscription_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of a subscription to upgrade. It must be on a free pricing. "
            "If checkout is successful, metadata set on this checkout "
            "will be copied to the subscription, and existing keys will be overwritten."
        ),
    )


class CheckoutUpdateBase(CustomFieldDataInputMixin, Schema):
    product_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of the product to checkout. "
            "Must be present in the checkout's product list."
        ),
    )
    product_price_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of the product price to checkout. "
            "Must correspond to a price present in the checkout's product list."
        ),
        deprecated=(
            "Use `product_id` unless you have a product with legacy pricing "
            "including several recurring intervals."
        ),
    )
    amount: Amount | None = None
    customer_name: Annotated[CustomerName | None, EmptyStrToNoneValidator] = None
    customer_email: CustomerEmail | None = None
    customer_billing_address: CustomerBillingAddress | None = None
    customer_tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None


class CheckoutUpdate(MetadataInputMixin, CheckoutUpdateBase):
    """Update an existing checkout session using an access token."""

    discount_id: UUID4 | None = Field(
        default=None, description="ID of the discount to apply to the checkout."
    )
    allow_discount_codes: bool | None = Field(
        default=None, description=_allow_discount_codes_description
    )
    require_billing_address: bool | None = Field(
        default=None, description=_require_billing_address_description
    )
    customer_ip_address: CustomerIPAddress | None = None
    customer_metadata: MetadataField | None = Field(
        default=None, description=_customer_metadata_description
    )
    success_url: SuccessURL = None
    embed_origin: EmbedOrigin = None


class CheckoutUpdatePublic(CheckoutUpdateBase):
    """Update an existing checkout session using the client secret."""

    discount_code: str | None = Field(
        default=None, description="Discount code to apply to the checkout."
    )


class CheckoutConfirmBase(CheckoutUpdatePublic): ...


class CheckoutConfirmStripe(CheckoutConfirmBase):
    """Confirm a checkout session using a Stripe confirmation token."""

    confirmation_token_id: str | None = Field(
        None,
        description=(
            "ID of the Stripe confirmation token. "
            "Required for fixed prices and custom prices."
        ),
    )


CheckoutConfirm = CheckoutConfirmStripe


class CheckoutCustomerBillingAddressFields(Schema):
    country: bool
    state: bool
    city: bool
    postal_code: bool
    line1: bool
    line2: bool

    @classmethod
    def from_checkout(cls, checkout: "CheckoutBase") -> Self:
        address = checkout.customer_billing_address
        country = address.country if address else None
        is_us = country == "US"
        require_billing_address = checkout.require_billing_address or is_us
        return cls(
            country=True,
            state=require_billing_address or country in {"US", "CA"},
            line1=require_billing_address,
            line2=require_billing_address,
            city=require_billing_address,
            postal_code=require_billing_address,
        )


class CheckoutBase(CustomFieldDataOutputMixin, IDSchema, TimestampedSchema):
    payment_processor: PaymentProcessor = Field(description="Payment processor used.")
    status: CheckoutStatus = Field(description="Status of the checkout session.")
    client_secret: str = Field(
        description=(
            "Client secret used to update and complete "
            "the checkout session from the client."
        )
    )
    url: str = Field(
        description="URL where the customer can access the checkout session."
    )
    expires_at: datetime = Field(
        description="Expiration date and time of the checkout session."
    )
    success_url: str = Field(
        description=(
            "URL where the customer will be redirected after a successful payment."
        )
    )
    embed_origin: str | None = Field(
        description="When checkout is embedded, "
        "represents the Origin of the page embedding the checkout. "
        "Used as a security measure to send messages only to the embedding page."
    )
    amount: int = Field(description="Amount in cents, before discounts and taxes.")
    discount_amount: int = Field(description="Discount amount in cents.")
    net_amount: int = Field(
        description="Amount in cents, after discounts but before taxes."
    )
    tax_amount: int | None = Field(
        description=(
            "Sales tax amount in cents. "
            "If `null`, it means there is no enough information yet to calculate it."
        )
    )
    total_amount: int = Field(description="Amount in cents, after discounts and taxes.")
    currency: str = Field(description="Currency code of the checkout session.")
    product_id: UUID4 = Field(description="ID of the product to checkout.")
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")
    discount_id: UUID4 | None = Field(
        description="ID of the discount applied to the checkout."
    )
    allow_discount_codes: bool = Field(description=_allow_discount_codes_description)
    require_billing_address: bool = Field(
        description=_require_billing_address_description
    )
    is_discount_applicable: bool = Field(
        description=(
            "Whether the discount is applicable to the checkout. "
            "Typically, free and custom prices are not discountable."
        )
    )
    is_free_product_price: bool = Field(
        description="Whether the product price is free, regardless of discounts."
    )
    is_payment_required: bool = Field(
        description=(
            "Whether the checkout requires payment, e.g. in case of free products "
            "or discounts that cover the total amount."
        )
    )
    is_payment_setup_required: bool = Field(
        description=(
            "Whether the checkout requires setting up a payment method, "
            "regardless of the amount, e.g. subscriptions that have first free cycles."
        )
    )
    is_payment_form_required: bool = Field(
        description=(
            "Whether the checkout requires a payment form, "
            "whether because of a payment or payment method setup."
        )
    )

    customer_id: UUID4 | None
    customer_name: str | None = Field(description="Name of the customer.")
    customer_email: str | None = Field(description="Email address of the customer.")
    customer_ip_address: CustomerIPAddress | None
    customer_billing_address: CustomerBillingAddress | None
    customer_tax_id: str | None = Field(
        validation_alias=AliasChoices("customer_tax_id_number", "customer_tax_id")
    )

    payment_processor_metadata: dict[str, str]

    subtotal_amount: SkipJsonSchema[int | None] = Field(
        deprecated="Use `net_amount`.", validation_alias="net_amount"
    )

    @computed_field
    def customer_billing_address_fields(self) -> CheckoutCustomerBillingAddressFields:
        """Determine which billing address fields should be shown in the checkout form."""
        return CheckoutCustomerBillingAddressFields.from_checkout(self)


class CheckoutProduct(ProductBase):
    """Product data for a checkout session."""

    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList


class CheckoutDiscountBase(IDSchema):
    name: str
    type: DiscountType
    duration: DiscountDuration
    code: str | None


class CheckoutDiscountFixedOnceForeverDuration(
    CheckoutDiscountBase, DiscountFixedBase, DiscountOnceForeverDurationBase
):
    """Schema for a fixed amount discount that is applied once or forever."""


class CheckoutDiscountFixedRepeatDuration(
    CheckoutDiscountBase, DiscountFixedBase, DiscountRepeatDurationBase
):
    """
    Schema for a fixed amount discount that is applied on every invoice
    for a certain number of months.
    """


class CheckoutDiscountPercentageOnceForeverDuration(
    CheckoutDiscountBase, DiscountPercentageBase, DiscountOnceForeverDurationBase
):
    """Schema for a percentage discount that is applied once or forever."""


class CheckoutDiscountPercentageRepeatDuration(
    CheckoutDiscountBase, DiscountPercentageBase, DiscountRepeatDurationBase
):
    """
    Schema for a percentage discount that is applied on every invoice
    for a certain number of months.
    """


def get_discount_discriminator_value(v: Any) -> str:
    if isinstance(v, dict):
        type = v["type"]
        duration = v["duration"]
    else:
        type = getattr(v, "type")
        duration = getattr(v, "duration")
    duration_tag = (
        "once_forever"
        if duration in {DiscountDuration.once, DiscountDuration.forever}
        else "repeat"
    )
    return f"{type}.{duration_tag}"


CheckoutDiscount = Annotated[
    Annotated[CheckoutDiscountFixedOnceForeverDuration, Tag("fixed.once_forever")]
    | Annotated[CheckoutDiscountFixedRepeatDuration, Tag("fixed.repeat")]
    | Annotated[
        CheckoutDiscountPercentageOnceForeverDuration, Tag("percentage.once_forever")
    ]
    | Annotated[CheckoutDiscountPercentageRepeatDuration, Tag("percentage.repeat")],
    Discriminator(get_discount_discriminator_value),
]


class Checkout(MetadataOutputMixin, CheckoutBase):
    """Checkout session data retrieved using an access token."""

    customer_external_id: str | None = Field(
        description=_external_customer_id_description
    )
    products: list[CheckoutProduct] = Field(
        description="List of products available to select."
    )
    product: CheckoutProduct = Field(description="Product selected to checkout.")
    product_price: ProductPrice = Field(description="Price of the selected product.")
    discount: CheckoutDiscount | None
    subscription_id: UUID4 | None
    attached_custom_fields: list[AttachedCustomField]
    customer_metadata: dict[str, str | int | bool]


class CheckoutPublic(CheckoutBase):
    """Checkout session data retrieved using the client secret."""

    products: list[CheckoutProduct] = Field(
        description="List of products available to select."
    )
    product: CheckoutProduct = Field(description="Product selected to checkout.")
    product_price: ProductPrice = Field(description="Price of the selected product.")
    discount: CheckoutDiscount | None
    organization: Organization
    attached_custom_fields: list[AttachedCustomField]


class CheckoutPublicConfirmed(CheckoutPublic):
    """
    Checkout session data retrieved using the client secret after confirmation.

    It contains a customer session token to retrieve order information
    right after the checkout.
    """

    status: Literal[CheckoutStatus.confirmed]
    customer_session_token: str
