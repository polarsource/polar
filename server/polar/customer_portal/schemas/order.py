from typing import Annotated, Literal

from pydantic import (
    MISSING,
    UUID4,
    AliasChoices,
    AliasPath,
    ConfigDict,
    Field,
    model_validator,
)
from pydantic.json_schema import SkipJsonSchema

from polar.enums import PaymentProcessor
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    MultipleQueryFilter,
    Schema,
    SetSchemaReference,
)
from polar.kit.versioning import Omissible, QuerySchema, Version
from polar.models.product import ProductBillingType
from polar.order.schemas import OrderBase, OrderItemSchema, OrderUpdateBase
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductID,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase, SubscriptionID
from polar.tax.tax_id import TaxID
from polar.version import V2026_10, V2027_01

from .organization import CustomerOrganization


class CustomerOrderProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: CustomerOrganization


class CustomerOrderSubscription(SubscriptionBase): ...


class CustomerOrder(OrderBase):
    tax_id: Annotated[TaxID | None, Version(starting_from=V2027_01)]
    user_id: Annotated[SkipJsonSchema[UUID4], Version(up_to=V2026_10)] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    product: CustomerOrderProduct | None
    product_price: Annotated[
        SkipJsonSchema[ProductPrice | None], Version(up_to=V2026_10)
    ] = Field(
        deprecated="Use `items` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "product_price",
            # Validate from ORM model
            "legacy_product_price",
        ),
    )
    subscription: CustomerOrderSubscription | None
    items: list[OrderItemSchema] = Field(description="Line items composing the order.")
    description: str = Field(
        description="A summary description of the order.", examples=["Pro Plan"]
    )
    payment_processor_metadata: Annotated[
        dict[str, str], Version(starting_from=V2027_01)
    ] = Field(
        description="Stripe intent information required to authenticate a payment.",
    )


class CustomerOrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")


class CustomerOrderReceipt(Schema):
    """Order's receipt data."""

    url: str = Field(..., description="The URL to the receipt PDF.")


class CustomerOrderUpdate(OrderUpdateBase):
    """Schema to update an order."""

    tax_id: Annotated[
        Omissible[str | None], EmptyStrToNoneValidator, Version(starting_from=V2027_01)
    ] = Field(
        MISSING, description="Tax ID for the billing address. Set to null to remove it."
    )
    discount_code: Annotated[
        Omissible[str | None], EmptyStrToNoneValidator, Version(starting_from=V2027_01)
    ] = Field(
        MISSING,
        description="Discount code to apply to the draft order. Set to null to remove it.",
    )


class CustomerOrderCreate(Schema):
    subscription_id: SubscriptionID = Field(
        description="ID of the subscription whose ended trial will be reactivated."
    )


class CustomerOrderPayWithPaymentMethod(Schema):
    model_config = ConfigDict(extra="forbid")

    payment_method_id: UUID4 = Field(
        description="ID of a payment method saved by the customer."
    )


class CustomerOrderPayWithConfirmationToken(Schema):
    model_config = ConfigDict(extra="forbid")

    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        PaymentProcessor.stripe,
        description="Payment processor that issued the confirmation token.",
    )
    confirmation_token_id: str = Field(
        description="ID of a Stripe confirmation token for the payment."
    )


CustomerOrderPay = Annotated[
    CustomerOrderPayWithPaymentMethod | CustomerOrderPayWithConfirmationToken,
    SetSchemaReference("CustomerOrderPay"),
]


class CustomerOrderPaymentStatus(Schema):
    """Payment status for an order."""

    status: str = Field(..., description="Current payment status.")
    error: str | None = Field(None, description="Error message if payment failed.")


class CustomerOrderConfirmPayment(Schema):
    """Schema to confirm a retry payment using either a saved payment method or a new confirmation token."""

    confirmation_token_id: str | None = Field(
        None, description="ID of the Stripe confirmation token for new payment methods."
    )
    payment_method_id: UUID4 | None = Field(
        None, description="ID of an existing saved payment method."
    )
    payment_processor: PaymentProcessor = Field(
        PaymentProcessor.stripe, description="Payment processor used."
    )

    @model_validator(mode="after")
    def validate_payment_method(self) -> "CustomerOrderConfirmPayment":
        """Ensure exactly one of confirmation_token_id or payment_method_id is provided."""
        if self.confirmation_token_id is None and self.payment_method_id is None:
            raise ValueError(
                "Either confirmation_token_id or payment_method_id must be provided"
            )
        if (
            self.confirmation_token_id is not None
            and self.payment_method_id is not None
        ):
            raise ValueError(
                "Only one of confirmation_token_id or payment_method_id can be provided"
            )
        return self


class CustomerOrderPaymentConfirmation(Schema):
    """Response after confirming a retry payment."""

    status: str = Field(..., description="Payment status after confirmation.")
    client_secret: str | None = Field(
        None, description="Client secret for handling additional actions."
    )
    error: str | None = Field(None, description="Error message if confirmation failed.")


class CustomerPortalOrderListParams(QuerySchema):
    product_id: MultipleQueryFilter[ProductID] | None = Field(
        None, title="ProductID Filter", description="Filter by product ID."
    )
    product_billing_type: MultipleQueryFilter[ProductBillingType] | None = Field(
        None,
        title="ProductBillingType Filter",
        description=(
            "Filter by product billing type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    )
    subscription_id: MultipleQueryFilter[SubscriptionID] | None = Field(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    )
    query: str | None = Field(
        None, description="Search by product or organization name."
    )
