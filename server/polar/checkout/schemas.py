from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import UUID4, Field, HttpUrl, IPvAnyAddress

from polar.enums import PaymentProcessor
from polar.kit.address import Address
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import (
    EmailStrDNS,
    EmptyStrToNoneValidator,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.checkout import CheckoutStatus
from polar.product.schemas import Product, ProductPrice

Amount = Annotated[
    int,
    Field(
        description=(
            "Amount to pay in cents. "
            "Only useful for custom prices, it'll be ignored for fixed and free prices."
        )
    ),
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


class CheckoutCreate(MetadataInputMixin, Schema):
    """Create a new checkout session."""

    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")
    amount: Amount | None = None
    customer_name: Annotated[CustomerName | None, EmptyStrToNoneValidator] = None
    customer_email: CustomerEmail | None = None
    customer_ip_address: CustomerIPAddress | None = None
    customer_billing_address: CustomerBillingAddress | None = None
    customer_tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None
    success_url: SuccessURL = None


class CheckoutCreatePublic(Schema):
    """Create a new checkout session from a client."""

    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")
    customer_email: CustomerEmail | None = None
    from_legacy_checkout_link: bool = False


class CheckoutUpdateBase(Schema):
    product_price_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of the product price to checkout. "
            "Must correspond to a price linked to the same product."
        ),
    )
    amount: Amount | None = None
    customer_name: Annotated[CustomerName | None, EmptyStrToNoneValidator] = None
    customer_email: CustomerEmail | None = None
    customer_billing_address: CustomerBillingAddress | None = None
    customer_tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None


class CheckoutUpdate(OptionalMetadataInputMixin, CheckoutUpdateBase):
    """Update an existing checkout session using an access token."""

    customer_ip_address: CustomerIPAddress | None = None
    success_url: SuccessURL = None


class CheckoutUpdatePublic(CheckoutUpdateBase):
    """Update an existing checkout session using the client secret."""


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


class CheckoutBase(IDSchema, TimestampedSchema):
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
    amount: Amount | None
    tax_amount: int | None = Field(description="Computed tax amount to pay in cents.")
    currency: str | None = Field(description="Currency code of the checkout session.")
    total_amount: int | None = Field(description="Total amount to pay in cents.")
    product_id: UUID4 = Field(description="ID of the product to checkout.")
    product_price_id: UUID4 = Field(description="ID of the product price to checkout.")
    is_payment_required: bool = Field(
        description=(
            "Whether the checkout requires payment. " "Useful to detect free products."
        )
    )

    customer_id: UUID4 | None
    customer_name: CustomerName | None
    customer_email: CustomerEmail | None
    customer_ip_address: CustomerIPAddress | None
    customer_billing_address: CustomerBillingAddress | None
    customer_tax_id: str | None = Field(validation_alias="customer_tax_id_number")

    payment_processor_metadata: dict[str, Any]


class Checkout(MetadataOutputMixin, CheckoutBase):
    """Checkout session data retrieved using an access token."""

    product: Product
    product_price: ProductPrice


class CheckoutPublic(CheckoutBase):
    """Checkout session data retrieved using the client secret."""

    product: Product
    product_price: ProductPrice
