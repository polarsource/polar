import dataclasses
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Any, Literal, overload

from dateutil.relativedelta import relativedelta
from pydantic import AfterValidator, Discriminator, EmailStr, Field, Tag

from polar.kit.address import AddressInput
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema
from polar.v2026_04.outputs import (
    LegacyRecurringProductPriceFixed,
    PaymentMethodCard,
    ProductPriceFixed,
)

if TYPE_CHECKING:
    from polar.v2026_04.outputs import (
        Checkout,
        CustomerBenefitGrantSlackSharedChannel,
        CustomerPaymentMethod,
        CustomerPortalCustomer,
        Order,
        Product,
        Subscription,
    )


@overload
def _parse_sdk_datetime(value: str) -> datetime: ...


@overload
def _parse_sdk_datetime(value: None) -> None: ...


def _parse_sdk_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


class OrganizationPlanPrice(Schema):
    amount: int
    currency: str


class OrganizationPlanFee(Schema):
    percent: int = Field(description="Percent fee in basis points (e.g. 380 = 3.80%).")
    fixed: int = Field(description="Fixed fee in cents.")


class OrganizationPlan(Schema):
    product_id: str | None = Field(
        default=None,
        description=(
            "Polar product ID. Null for the synthesized free plan, which has no "
            "underlying Polar product."
        ),
    )
    name: str
    description: str | None = None
    recurring_interval: str | None = None
    price: OrganizationPlanPrice | None = None
    transaction_fee: OrganizationPlanFee | None = None
    highlight: bool = False
    custom: bool = False
    features: list[str] = Field(default_factory=list)

    @classmethod
    def free(
        cls, *, fee_percent: int, fee_fixed: int, currency: str = "usd"
    ) -> "OrganizationPlan":
        return cls(
            product_id=None,
            name="Free",
            description="Free to start and validate ideas",
            recurring_interval=None,
            price=OrganizationPlanPrice(amount=0, currency=currency),
            transaction_fee=OrganizationPlanFee(percent=fee_percent, fixed=fee_fixed),
            highlight=False,
            custom=False,
            features=["All features to sell", "Standard Support"],
        )

    @classmethod
    def early_member(
        cls, *, fee_percent: int, fee_fixed: int, currency: str = "usd"
    ) -> "OrganizationPlan":
        return cls(
            product_id=None,
            name="Early Member",
            description="For our founding community of early members.",
            recurring_interval=None,
            price=OrganizationPlanPrice(amount=0, currency=currency),
            transaction_fee=OrganizationPlanFee(percent=fee_percent, fixed=fee_fixed),
            highlight=False,
            custom=False,
            features=["All features to sell", "Standard Support"],
        )

    @classmethod
    def from_sdk(cls, product: "Product") -> "OrganizationPlan":
        metadata = product.metadata or {}
        fixed_price = next(
            (
                p
                for p in product.prices
                if isinstance(p, ProductPriceFixed | LegacyRecurringProductPriceFixed)
            ),
            None,
        )
        fee_benefit = next(
            (
                b
                for b in product.benefits
                if (b.metadata or {}).get("type") == "transaction_fee"
            ),
            None,
        )
        features_raw = metadata.get("features", "")
        return cls(
            product_id=product.id,
            name=product.name,
            description=(
                str(metadata["description"])
                if "description" in metadata
                else product.description
            ),
            recurring_interval=(
                product.recurring_interval
                if product.recurring_interval is not None
                else None
            ),
            price=(
                OrganizationPlanPrice(
                    amount=fixed_price.price_amount,
                    currency=fixed_price.price_currency,
                )
                if fixed_price is not None
                else None
            ),
            transaction_fee=(
                OrganizationPlanFee(
                    percent=int(fee_benefit.metadata["fee_percent"]),
                    fixed=int(fee_benefit.metadata["fee_fixed"]),
                )
                if fee_benefit is not None
                else None
            ),
            highlight=bool(metadata.get("highlight", False)),
            custom=bool(metadata.get("custom", False)),
            features=[f.strip() for f in str(features_raw).split(",") if f.strip()],
        )


class OrganizationSubscriptionPendingChange(Schema):
    product_id: str
    applies_at: datetime


class OrganizationSubscriptionDiscount(Schema):
    """A discount currently applied to the organization's subscription."""

    discount_id: str
    name: str
    type: str = Field(description="Discount type: 'percentage' or 'fixed'.")
    duration: str = Field(
        description="Discount duration: 'once', 'forever', or 'repeating'."
    )
    duration_in_months: int | None = Field(
        default=None,
        description="Number of months the discount repeats; only set for 'repeating'.",
    )
    basis_points: int | None = Field(
        default=None,
        description="Percentage in basis points (10000 = 100%); only set for 'percentage'.",
    )
    amounts: dict[str, int] | None = Field(
        default=None,
        description="Per-currency fixed amount in cents; only set for 'fixed'.",
    )
    ends_at: datetime | None = Field(
        default=None,
        description=(
            "Estimated date the discount stops applying. Computed for 'repeating' "
            "discounts from the subscription's started_at + duration_in_months; "
            "null for 'once' and 'forever' durations."
        ),
    )

    @classmethod
    def from_sdk(
        cls, subscription: "Subscription"
    ) -> "OrganizationSubscriptionDiscount | None":
        discount = subscription.discount
        if discount is None:
            return None

        duration_raw = getattr(discount, "duration", None)
        type_raw = getattr(discount, "type", None)
        if duration_raw is None or type_raw is None:
            return None
        duration = str(duration_raw)
        discount_type = str(type_raw)
        duration_in_months = getattr(discount, "duration_in_months", None)
        started_at = (
            datetime.fromisoformat(subscription.started_at)
            if subscription.started_at is not None
            else None
        )

        ends_at: datetime | None = None
        if (
            duration == "repeating"
            and duration_in_months is not None
            and started_at is not None
        ):
            ends_at = started_at + relativedelta(months=duration_in_months)

        return cls(
            discount_id=discount.id,
            name=discount.name,
            type=discount_type,
            duration=duration,
            duration_in_months=duration_in_months,
            basis_points=getattr(discount, "basis_points", None),
            amounts=getattr(discount, "amounts", None),
            ends_at=ends_at,
        )


class OrganizationSubscription(Schema):
    subscription_id: str | None = Field(
        default=None,
        description=(
            "Polar subscription ID. Null when the organization has no active "
            "subscription and is on the free plan."
        ),
    )
    status: str
    product_id: str | None = None
    plan: OrganizationPlan
    amount: int
    currency: str
    recurring_interval: str | None = None
    recurring_interval_count: int | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False
    canceled_at: datetime | None = None
    started_at: datetime | None = None
    ends_at: datetime | None = None
    pending_change: OrganizationSubscriptionPendingChange | None = None
    discount: OrganizationSubscriptionDiscount | None = None
    startup_program_status: str | None = Field(
        default=None,
        description=(
            "Polar Startup Program status for this organization. Derived from "
            "the organization's Startup Program discount: 'invited' when the "
            "discount exists and hasn't been redeemed, 'consumed' once it has. "
            "Null when the feature is disabled or the organization hasn't "
            "been invited."
        ),
    )
    startup_program_scale_product_id: str | None = Field(
        default=None,
        description=(
            "Polar product id of the Scale plan, against which the Startup "
            "Program discount applies. Null when the feature is disabled."
        ),
    )

    @classmethod
    def free(cls, *, plan: OrganizationPlan) -> "OrganizationSubscription":
        currency = plan.price.currency if plan.price is not None else "usd"
        return cls(
            subscription_id=None,
            status="active",
            product_id=None,
            plan=plan,
            amount=0,
            currency=currency,
            recurring_interval=None,
            recurring_interval_count=None,
            current_period_start=None,
            current_period_end=None,
            cancel_at_period_end=False,
            canceled_at=None,
            started_at=None,
            ends_at=None,
            pending_change=None,
            discount=None,
        )

    @classmethod
    def from_sdk(cls, subscription: "Subscription") -> "OrganizationSubscription":
        pending = subscription.pending_update
        return cls(
            subscription_id=subscription.id,
            status=subscription.status,
            product_id=subscription.product_id,
            plan=OrganizationPlan.from_sdk(subscription.product),
            amount=subscription.amount,
            currency=subscription.currency,
            recurring_interval=subscription.recurring_interval,
            recurring_interval_count=subscription.recurring_interval_count,
            current_period_start=_parse_sdk_datetime(subscription.current_period_start),
            current_period_end=_parse_sdk_datetime(subscription.current_period_end),
            cancel_at_period_end=subscription.cancel_at_period_end,
            canceled_at=_parse_sdk_datetime(subscription.canceled_at),
            started_at=_parse_sdk_datetime(subscription.started_at),
            ends_at=_parse_sdk_datetime(subscription.ends_at),
            pending_change=(
                OrganizationSubscriptionPendingChange(
                    product_id=pending.product_id,
                    applies_at=_parse_sdk_datetime(pending.applies_at),
                )
                if pending is not None and pending.product_id is not None
                else None
            ),
            discount=OrganizationSubscriptionDiscount.from_sdk(subscription),
        )


class OrganizationCheckoutRequest(Schema):
    product_id: str = Field(description="Polar product ID to subscribe to.")
    success_url: Annotated[str, AfterValidator(get_safe_return_url)] | None = None
    return_url: Annotated[str, AfterValidator(get_safe_return_url)] | None = None
    embed_origin: str | None = None


class OrganizationCheckoutResponse(Schema):
    checkout_id: str
    url: str
    expires_at: datetime

    @classmethod
    def from_sdk(cls, checkout: "Checkout") -> "OrganizationCheckoutResponse":
        return cls(
            checkout_id=checkout.id,
            url=checkout.url,
            expires_at=_parse_sdk_datetime(checkout.expires_at),
        )


class OrganizationStartupProgramClaimRequest(Schema):
    """Inputs for claiming the Startup Program discount.

    The checkout URLs are only used when the org is on the Free plan and
    needs a checkout to set up a payment method; they're ignored on the
    PATCH path (already-paid orgs).
    """

    success_url: Annotated[str, AfterValidator(get_safe_return_url)] | None = None
    return_url: Annotated[str, AfterValidator(get_safe_return_url)] | None = None
    embed_origin: str | None = None


class OrganizationStartupProgramClaimResponse(Schema):
    """Result of claiming the Startup Program discount.

    Exactly one field is set:
    - ``checkout`` — Free → Scale: org needs to complete the checkout. The
      discount is already attached.
    - ``subscription`` — Paid → Scale: the existing paid subscription was
      switched to Scale and the discount applied immediately.
    """

    checkout: OrganizationCheckoutResponse | None = None
    subscription: OrganizationSubscription | None = None


class OrganizationSubscriptionUpdate(Schema):
    product_id: str = Field(description="Polar product ID to switch the plan to.")


class OrganizationOrder(Schema):
    id: str
    created_at: datetime
    invoice_number: str | None
    status: str
    paid: bool
    total_amount: int = Field(
        description="Total amount in cents, after discount and tax."
    )
    refunded_amount: int = Field(description="Refunded amount in cents.")
    currency: str
    billing_reason: str
    product_name: str
    is_invoice_generated: bool

    @classmethod
    def from_sdk(cls, order: "Order") -> "OrganizationOrder":
        product = order.product
        return cls(
            id=order.id,
            created_at=_parse_sdk_datetime(order.created_at),
            invoice_number=order.invoice_number,
            status=order.status,
            paid=order.paid,
            total_amount=order.total_amount,
            refunded_amount=order.refunded_amount,
            currency=order.currency,
            billing_reason=order.billing_reason,
            product_name=product.name if product is not None else order.description,
            is_invoice_generated=order.is_invoice_generated,
        )


class OrganizationOrderInvoice(Schema):
    url: str


class OrganizationBillingDetails(Schema):
    billing_name: str | None = Field(
        default=None,
        description="The name shown on invoices. Falls back to the customer name.",
    )
    billing_address: AddressInput | None = Field(
        default=None,
        description="Postal address used on invoices.",
    )
    tax_id: str | None = Field(
        default=None,
        description="Tax identifier value (without the format suffix).",
    )

    @classmethod
    def from_sdk(
        cls, customer: "CustomerPortalCustomer"
    ) -> "OrganizationBillingDetails":
        tax_id_value: str | None = None
        if customer.tax_id:
            first = customer.tax_id[0]
            if isinstance(first, str):
                tax_id_value = first
        billing_address = (
            AddressInput.model_validate(dataclasses.asdict(customer.billing_address))
            if customer.billing_address is not None
            else None
        )
        return cls(
            billing_name=customer.billing_name,
            billing_address=billing_address,
            tax_id=tax_id_value,
        )


class OrganizationBillingDetailsUpdate(Schema):
    billing_name: str | None = None
    billing_address: AddressInput | None = None
    tax_id: str | None = None


class OrganizationPaymentMethodCardMetadata(Schema):
    brand: str
    last4: str
    exp_month: int
    exp_year: int


class OrganizationPaymentMethodCard(Schema):
    id: str
    type: Literal["card"] = "card"
    default: bool
    method_metadata: OrganizationPaymentMethodCardMetadata


class OrganizationPaymentMethodGeneric(Schema):
    id: str
    type: str
    default: bool


def _payment_method_discriminator(value: Any) -> str:
    type_value = (
        value.get("type") if isinstance(value, dict) else getattr(value, "type", None)
    )
    return "card" if type_value == "card" else "generic"


OrganizationPaymentMethod = Annotated[
    Annotated[OrganizationPaymentMethodCard, Tag("card")]
    | Annotated[OrganizationPaymentMethodGeneric, Tag("generic")],
    Discriminator(_payment_method_discriminator),
]


class OrganizationCustomerSession(Schema):
    token: str = Field(
        description=(
            "Short-lived customer session token bound to this organization's "
            "mirrored Polar billing customer. Authenticates against "
            "`/v1/customer-portal/customers/me/*` for the duration of its TTL."
        ),
    )


class OrganizationBenefitGrant(Schema):
    id: str
    benefit_description: str
    is_granted: bool = Field(
        description="Whether the channel is provisioned and the invite sent.",
    )
    is_connected: bool = Field(
        description="Whether the invite was accepted by the customer's workspace.",
    )
    invited_email: str | None = Field(
        default=None,
        description="Email of the Slack workspace admin the invite was sent to.",
    )
    invite_url: str | None = Field(
        default=None,
        description=(
            "Slack Connect invite URL. Not always available: Slack omits it "
            "for some email invites."
        ),
    )
    channel_name: str | None = None
    error_message: str | None = Field(
        default=None,
        description="Message of the last provisioning error, if any.",
    )

    @classmethod
    def from_sdk(
        cls, grant: "CustomerBenefitGrantSlackSharedChannel"
    ) -> "OrganizationBenefitGrant":
        return cls(
            id=grant.id,
            benefit_description=grant.benefit.description,
            is_granted=grant.is_granted,
            is_connected=grant.properties.connected_team_id is not None,
            invited_email=grant.properties.invited_email,
            invite_url=grant.properties.invite_url,
            channel_name=grant.properties.channel_name,
            error_message=grant.error.message if grant.error else None,
        )


class OrganizationBenefitGrantUpdate(Schema):
    invited_email: EmailStr = Field(
        description=(
            "Email of an admin in the customer's Slack workspace who should "
            "receive the Slack Connect invite."
        ),
    )


def organization_payment_method_from_sdk(
    method: "CustomerPaymentMethod", *, default_payment_method_id: str | None
) -> OrganizationPaymentMethod:
    is_default = default_payment_method_id is not None and (
        method.id == default_payment_method_id
    )
    if isinstance(method, PaymentMethodCard):
        metadata = method.method_metadata
        return OrganizationPaymentMethodCard(
            id=method.id,
            default=is_default,
            method_metadata=OrganizationPaymentMethodCardMetadata(
                brand=metadata.brand,
                last4=metadata.last4,
                exp_month=metadata.exp_month,
                exp_year=metadata.exp_year,
            ),
        )
    return OrganizationPaymentMethodGeneric(
        id=method.id,
        type=method.type,
        default=is_default,
    )
