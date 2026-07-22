from __future__ import annotations

import dataclasses
import typing

from polar.v2026_04.literals import (
    BenefitType,
    BenefitVisibility,
    BillingAddressFieldMode,
    CheckoutStatus,
    CountryAlpha2,
    CustomerCancellationReason,
    CustomerType,
    DiscountDuration,
    DiscountType,
    DisputeStatus,
    EventSource,
    FileServiceTypes,
    FilterConjunction,
    FilterOperator,
    Func,
    LicenseKeyStatus,
    MemberRole,
    MeterUnit,
    MetricType,
    OrderBillingReason,
    OrderStatus,
    OrganizationSocialPlatforms,
    OrganizationStatus,
    PaymentProcessor,
    PaymentStatus,
    PaymentTrigger,
    Permission,
    ProductPriceSource,
    ProductVisibility,
    PublicSubscriptionProrationBehavior,
    RecurringInterval,
    RefundReason,
    RefundStatus,
    Scope,
    SeatStatus,
    SeatTierType,
    Status,
    SubscriptionProrationBehavior,
    SubscriptionStatus,
    SubType,
    TaxBehavior,
    TaxBehaviorOption,
    Timeframe,
    TokenType,
    TrialInterval,
    WebhookEventType,
    WebhookFormat,
)


@dataclasses.dataclass(kw_only=True, slots=True)
class Address:
    line1: str | None = None

    line2: str | None = None

    postal_code: str | None = None

    city: str | None = None

    state: str | None = None

    country: CountryAlpha2


@dataclasses.dataclass(kw_only=True, slots=True)
class AddressDict:
    line1: str | None = None

    line2: str | None = None

    postal_code: str | None = None

    city: str | None = None

    state: str | None = None

    country: str


@dataclasses.dataclass(kw_only=True, slots=True)
class AlreadyActiveSubscriptionError:
    error: typing.Literal["AlreadyActiveSubscriptionError"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class AlreadyCanceledSubscription:
    error: typing.Literal["AlreadyCanceledSubscription"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class AmbiguousExternalCustomerID:
    error: typing.Literal["AmbiguousExternalCustomerID"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class AttachedCustomField:
    """Schema of a custom field attached to a resource."""

    custom_field_id: str
    """ID of the custom field."""

    custom_field: CustomField

    order: int
    """Order of the custom field in the resource."""

    required: bool
    """Whether the value is required for this custom field."""


@dataclasses.dataclass(kw_only=True, slots=True)
class AuthorizeOrganization:
    id: str

    slug: str

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class AuthorizeResponseOrganization:
    client: OAuth2ClientPublic

    sub_type: typing.Literal["organization"]

    sub: AuthorizeOrganization | None

    scopes: list[Scope]

    organizations: list[AuthorizeOrganization]

    requires_single_organization: bool = False

    scope_display_names: dict[str, str] = dataclasses.field(
        default_factory=lambda: {
            "openid": "OpenID",
            "profile": "Read your profile",
            "email": "Read your email address",
            "user:read": "Read your user account",
            "user:write": "Manage your user account",
            "organizations:read": "Read your organizations",
            "organizations:write": "Create or modify organizations",
            "custom_fields:read": "Read custom fields",
            "custom_fields:write": "Create or modify custom fields",
            "discounts:read": "Read discounts",
            "discounts:write": "Create or modify discounts",
            "checkout_links:read": "Read checkout links",
            "checkout_links:write": "Create or modify checkout links",
            "checkouts:read": "Read checkout sessions",
            "checkouts:write": "Create or modify checkout sessions",
            "transactions:read": "Read transactions",
            "transactions:write": "Create or modify transactions",
            "payouts:read": "Read payouts",
            "payouts:write": "Create or modify payouts",
            "products:read": "Read products",
            "products:write": "Create or modify products",
            "benefits:read": "Read benefits",
            "benefits:write": "Create or modify benefits",
            "events:read": "Read events",
            "events:write": "Create events",
            "meters:read": "Read meters",
            "meters:write": "Create or modify meters",
            "files:read": "Read file uploads",
            "files:write": "Create or modify file uploads",
            "subscriptions:read": "Read subscriptions made on your organizations",
            "subscriptions:write": "Create or modify subscriptions made on your organizations",
            "customers:read": "Read customers",
            "customers:write": "Create or modify customers",
            "members:read": "Read members",
            "members:write": "Create or modify members",
            "wallets:read": "Read wallets",
            "wallets:write": "Create or modify wallets",
            "disputes:read": "Read disputes",
            "disputes:write": "Create or modify disputes",
            "customer_meters:read": "Read customer meters",
            "customer_sessions:write": "Create or modify customer sessions",
            "member_sessions:write": "Create or modify member sessions",
            "customer_seats:read": "Read customer seats",
            "customer_seats:write": "Create or modify customer seats",
            "orders:read": "Read orders made on your organizations",
            "orders:write": "Modify orders made on your organizations",
            "refunds:read": "Read refunds made on your organizations",
            "refunds:write": "Create or modify refunds",
            "payments:read": "Read payments made on your organizations",
            "metrics:read": "Read metrics",
            "metrics:write": "Create or modify metric definitions",
            "webhooks:read": "Read webhooks",
            "webhooks:write": "Create or modify webhooks",
            "license_keys:read": "Read license keys",
            "license_keys:write": "Modify license keys",
            "customer_portal:read": "Read your orders, subscriptions and benefits",
            "customer_portal:write": "Create or modify your orders, subscriptions and benefits",
            "notifications:read": "Read notifications",
            "notifications:write": "Mark notifications as read",
            "notification_recipients:read": "Read notification recipients",
            "notification_recipients:write": "Create or modify notification recipients",
            "organization_access_tokens:read": "Read organization access tokens",
            "organization_access_tokens:write": "Create or modify organization access tokens",
        }
    )


@dataclasses.dataclass(kw_only=True, slots=True)
class AuthorizeResponseUser:
    client: OAuth2ClientPublic

    sub_type: typing.Literal["user"]

    sub: AuthorizeUser | None

    scopes: list[Scope]

    organizations: list[AuthorizeOrganization]

    requires_single_organization: bool = False

    scope_display_names: dict[str, str] = dataclasses.field(
        default_factory=lambda: {
            "openid": "OpenID",
            "profile": "Read your profile",
            "email": "Read your email address",
            "user:read": "Read your user account",
            "user:write": "Manage your user account",
            "organizations:read": "Read your organizations",
            "organizations:write": "Create or modify organizations",
            "custom_fields:read": "Read custom fields",
            "custom_fields:write": "Create or modify custom fields",
            "discounts:read": "Read discounts",
            "discounts:write": "Create or modify discounts",
            "checkout_links:read": "Read checkout links",
            "checkout_links:write": "Create or modify checkout links",
            "checkouts:read": "Read checkout sessions",
            "checkouts:write": "Create or modify checkout sessions",
            "transactions:read": "Read transactions",
            "transactions:write": "Create or modify transactions",
            "payouts:read": "Read payouts",
            "payouts:write": "Create or modify payouts",
            "products:read": "Read products",
            "products:write": "Create or modify products",
            "benefits:read": "Read benefits",
            "benefits:write": "Create or modify benefits",
            "events:read": "Read events",
            "events:write": "Create events",
            "meters:read": "Read meters",
            "meters:write": "Create or modify meters",
            "files:read": "Read file uploads",
            "files:write": "Create or modify file uploads",
            "subscriptions:read": "Read subscriptions made on your organizations",
            "subscriptions:write": "Create or modify subscriptions made on your organizations",
            "customers:read": "Read customers",
            "customers:write": "Create or modify customers",
            "members:read": "Read members",
            "members:write": "Create or modify members",
            "wallets:read": "Read wallets",
            "wallets:write": "Create or modify wallets",
            "disputes:read": "Read disputes",
            "disputes:write": "Create or modify disputes",
            "customer_meters:read": "Read customer meters",
            "customer_sessions:write": "Create or modify customer sessions",
            "member_sessions:write": "Create or modify member sessions",
            "customer_seats:read": "Read customer seats",
            "customer_seats:write": "Create or modify customer seats",
            "orders:read": "Read orders made on your organizations",
            "orders:write": "Modify orders made on your organizations",
            "refunds:read": "Read refunds made on your organizations",
            "refunds:write": "Create or modify refunds",
            "payments:read": "Read payments made on your organizations",
            "metrics:read": "Read metrics",
            "metrics:write": "Create or modify metric definitions",
            "webhooks:read": "Read webhooks",
            "webhooks:write": "Create or modify webhooks",
            "license_keys:read": "Read license keys",
            "license_keys:write": "Modify license keys",
            "customer_portal:read": "Read your orders, subscriptions and benefits",
            "customer_portal:write": "Create or modify your orders, subscriptions and benefits",
            "notifications:read": "Read notifications",
            "notifications:write": "Mark notifications as read",
            "notification_recipients:read": "Read notification recipients",
            "notification_recipients:write": "Create or modify notification recipients",
            "organization_access_tokens:read": "Read organization access tokens",
            "organization_access_tokens:write": "Create or modify organization access tokens",
        }
    )


@dataclasses.dataclass(kw_only=True, slots=True)
class AuthorizeUser:
    id: str

    email: str

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceCreditOrderEvent:
    """An event created by Polar when an order is paid via customer balance."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.credit_order"]
    """The name of the event."""

    metadata: BalanceCreditOrderMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceCreditOrderMetadata:
    order_id: str

    product_id: str | None = None

    subscription_id: str | None = None

    amount: int

    currency: str

    tax_amount: int

    tax_state: str | None = None

    tax_country: str | None = None

    fee: int

    exchange_rate: float | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceDisputeEvent:
    """An event created by Polar when an order is disputed."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.dispute"]
    """The name of the event."""

    metadata: BalanceDisputeMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceDisputeMetadata:
    transaction_id: str

    dispute_id: str

    order_id: str | None = None

    order_created_at: str | None = None

    product_id: str | None = None

    subscription_id: str | None = None

    amount: int

    currency: str

    presentment_amount: int

    presentment_currency: str

    tax_amount: int

    tax_state: str | None = None

    tax_country: str | None = None

    fee: int

    exchange_rate: float | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceDisputeReversalEvent:
    """An event created by Polar when a dispute is won and funds are reinstated."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.dispute_reversal"]
    """The name of the event."""

    metadata: BalanceDisputeMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceOrderEvent:
    """An event created by Polar when an order is paid."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.order"]
    """The name of the event."""

    metadata: BalanceOrderMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceOrderMetadata:
    transaction_id: str

    order_id: str

    product_id: str | None = None

    subscription_id: str | None = None

    amount: int

    net_amount: int | None = None

    currency: str

    presentment_amount: int

    presentment_currency: str

    tax_amount: int

    tax_state: str | None = None

    tax_country: str | None = None

    fee: int

    exchange_rate: float | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceRefundEvent:
    """An event created by Polar when an order is refunded."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.refund"]
    """The name of the event."""

    metadata: BalanceRefundMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceRefundMetadata:
    transaction_id: str

    refund_id: str

    order_id: str | None = None

    order_created_at: str | None = None

    product_id: str | None = None

    subscription_id: str | None = None

    amount: int

    currency: str

    presentment_amount: int

    presentment_currency: str

    refundable_amount: int | None = None

    tax_amount: int

    tax_state: str | None = None

    tax_country: str | None = None

    fee: int

    exchange_rate: float | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BalanceRefundReversalEvent:
    """An event created by Polar when a refund is reverted."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["balance.refund_reversal"]
    """The name of the event."""

    metadata: BalanceRefundMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitCustom:
    """A benefit of type `custom`.

    Use it to grant any kind of benefit that doesn't fit in the other types."""

    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["custom"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitCustomProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitCustomProperties:
    """Properties for a benefit of type `custom`."""

    note: str | None | None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitCustomSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["custom"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitCustomSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitCustomSubscriberProperties:
    """Properties available to subscribers for a benefit of type `custom`."""

    note: str | None | None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitCycledEvent:
    """An event created by Polar when a benefit is cycled."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["benefit.cycled"]
    """The name of the event."""

    metadata: BenefitGrantMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDiscord:
    """A benefit of type `discord`.

    Use it to automatically invite your backers to a Discord server."""

    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["discord"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitDiscordProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDiscordProperties:
    """Properties for a benefit of type `discord`."""

    guild_id: str
    """The ID of the Discord server."""

    role_id: str
    """The ID of the Discord role to grant."""

    kick_member: bool
    """Whether to kick the member from the Discord server on revocation."""

    guild_token: str


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDiscordSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["discord"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitDiscordSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDiscordSubscriberProperties:
    """Properties available to subscribers for a benefit of type `discord`."""

    guild_id: str
    """The ID of the Discord server."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDownloadables:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["downloadables"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitDownloadablesProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDownloadablesProperties:
    archived: dict[str, bool]

    files: list[str]


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDownloadablesSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["downloadables"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitDownloadablesSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitDownloadablesSubscriberProperties:
    active_files: list[str]


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitFeatureFlag:
    """A benefit of type `feature_flag`.

    Use it to grant feature flags with key-value metadata
    that can be queried via the API and webhooks."""

    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["feature_flag"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitFeatureFlagProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitFeatureFlagProperties:
    """Properties for a benefit of type `feature_flag`."""

    ...


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitFeatureFlagSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["feature_flag"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitFeatureFlagSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitFeatureFlagSubscriberProperties:
    """Properties available to subscribers for a benefit of type `feature_flag`."""

    ...


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGitHubRepository:
    """A benefit of type `github_repository`.

    Use it to automatically invite your backers to a private GitHub repository."""

    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["github_repository"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitGitHubRepositoryProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGitHubRepositoryProperties:
    """Properties for a benefit of type `github_repository`."""

    repository_owner: str
    """The owner of the repository."""

    repository_name: str
    """The name of the repository."""

    permission: Permission
    """The permission level to grant. Read more about roles and their permissions on [GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role)."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGitHubRepositorySubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["github_repository"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitGitHubRepositorySubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGitHubRepositorySubscriberProperties:
    """Properties available to subscribers for a benefit of type `github_repository`."""

    repository_owner: str
    """The owner of the repository."""

    repository_name: str
    """The name of the repository."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrant:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: Benefit

    properties: (
        BenefitGrantDiscordProperties
        | BenefitGrantGitHubRepositoryProperties
        | BenefitGrantDownloadablesProperties
        | BenefitGrantLicenseKeysProperties
        | BenefitGrantCustomProperties
        | BenefitGrantFeatureFlagProperties
        | BenefitGrantSlackSharedChannelProperties
    )


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantCustomProperties: ...


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantCustomWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitCustom

    properties: BenefitGrantCustomProperties

    previous_properties: BenefitGrantCustomProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantDiscordProperties:
    account_id: str | None = None

    guild_id: str | None = None

    role_id: str | None = None

    granted_account_id: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantDiscordWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitDiscord

    properties: BenefitGrantDiscordProperties

    previous_properties: BenefitGrantDiscordProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantDownloadablesProperties:
    files: list[str] | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantDownloadablesWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitDownloadables

    properties: BenefitGrantDownloadablesProperties

    previous_properties: BenefitGrantDownloadablesProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantError:
    message: str

    type: str

    timestamp: str


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantFeatureFlagProperties: ...


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantFeatureFlagWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitFeatureFlag

    properties: BenefitGrantFeatureFlagProperties

    previous_properties: BenefitGrantFeatureFlagProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantGitHubRepositoryProperties:
    account_id: str | None = None

    repository_owner: str | None = None

    repository_name: str | None = None

    permission: Permission | None = None

    granted_account_id: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantGitHubRepositoryWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitGitHubRepository

    properties: BenefitGrantGitHubRepositoryProperties

    previous_properties: BenefitGrantGitHubRepositoryProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantLicenseKeysProperties:
    user_provided_key: str | None = None

    license_key_id: str | None = None

    display_key: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantLicenseKeysWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitLicenseKeys

    properties: BenefitGrantLicenseKeysProperties

    previous_properties: BenefitGrantLicenseKeysProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantMetadata:
    benefit_id: str

    benefit_grant_id: str

    benefit_type: BenefitType

    member_id: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantMeterCreditProperties:
    last_credited_meter_id: str | None = None

    last_credited_units: int | None = None

    last_credited_at: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantMeterCreditWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitMeterCredit

    properties: BenefitGrantMeterCreditProperties

    previous_properties: BenefitGrantMeterCreditProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantSlackSharedChannelProperties:
    invited_email: str | None = None

    channel_id: str | None = None

    channel_name: str | None = None

    invite_id: str | None = None

    invite_url: str | None = None

    connected_team_id: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantSlackSharedChannelWebhook:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the grant."""

    granted_at: str | None = None
    """The timestamp when the benefit was granted. If `None`, the benefit is not granted."""

    is_granted: bool
    """Whether the benefit is granted."""

    revoked_at: str | None = None
    """The timestamp when the benefit was revoked. If `None`, the benefit is not revoked."""

    is_revoked: bool
    """Whether the benefit is revoked."""

    subscription_id: str | None
    """The ID of the subscription that granted this benefit."""

    order_id: str | None
    """The ID of the order that granted this benefit."""

    customer_id: str
    """The ID of the customer concerned by this grant."""

    member_id: str | None = None
    """The ID of the member concerned by this grant."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    error: BenefitGrantError | None = None
    """The error information if the benefit grant failed with an unrecoverable error."""

    customer: Customer

    member: Member | None = None

    benefit: BenefitSlackSharedChannel

    properties: BenefitGrantSlackSharedChannelProperties

    previous_properties: BenefitGrantSlackSharedChannelProperties | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitGrantedEvent:
    """An event created by Polar when a benefit is granted to a customer."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["benefit.granted"]
    """The name of the event."""

    metadata: BenefitGrantMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeyActivationProperties:
    limit: int

    enable_customer_admin: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeyExpirationProperties:
    ttl: int

    timeframe: Timeframe


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeys:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["license_keys"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitLicenseKeysProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeysProperties:
    prefix: str | None

    expires: BenefitLicenseKeyExpirationProperties | None

    activations: BenefitLicenseKeyActivationProperties | None

    limit_usage: int | None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeysSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["license_keys"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitLicenseKeysSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitLicenseKeysSubscriberProperties:
    prefix: str | None

    expires: BenefitLicenseKeyExpirationProperties | None

    activations: BenefitLicenseKeyActivationProperties | None

    limit_usage: int | None


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitMeterCredit:
    """A benefit of type `meter_unit`.

    Use it to grant a number of units on a specific meter."""

    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["meter_credit"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitMeterCreditProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitMeterCreditProperties:
    """Properties for a benefit of type `meter_unit`."""

    units: int

    rollover: bool

    meter_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitMeterCreditSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["meter_credit"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitMeterCreditSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitMeterCreditSubscriberProperties:
    """Properties available to subscribers for a benefit of type `meter_unit`."""

    units: int

    rollover: bool

    meter_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitPublic:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: BenefitType

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitRevokedEvent:
    """An event created by Polar when a benefit is revoked from a customer."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["benefit.revoked"]
    """The name of the event."""

    metadata: BenefitGrantMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitSlackSharedChannel:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["slack_shared_channel"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    metadata: MetadataOutputType

    visibility: BenefitVisibility

    properties: BenefitSlackSharedChannelProperties

    visibility_configurable: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitSlackSharedChannelProperties:
    slack_integration_id: str
    """Polar Slack integration linked to this benefit."""

    channel_name_template: str
    """Template for the channel name. Supports placeholders: {customer_name}, {customer_email_local}, and {metadata.<key>} for any value stored in customer user metadata."""

    private: bool = True
    """Create the channel as private (recommended)."""

    welcome_message: str | None = None
    """Optional message posted to the channel right after creation."""

    archive_on_revoke: bool = True
    """Archive the channel when the benefit is revoked."""

    team_invitees: list[str] | None = None
    """Slack user IDs from the merchant workspace to invite to every channel created for this benefit."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitSlackSharedChannelSubscriber:
    id: str
    """The ID of the benefit."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    type: typing.Literal["slack_shared_channel"]

    description: str
    """The description of the benefit."""

    selectable: bool
    """Whether the benefit is selectable when creating a product."""

    deletable: bool
    """Whether the benefit is deletable."""

    is_deleted: bool
    """Whether the benefit is deleted."""

    organization_id: str
    """The ID of the organization owning the benefit."""

    organization: BenefitSubscriberOrganization

    properties: BenefitSlackSharedChannelSubscriberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitSlackSharedChannelSubscriberProperties: ...


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitSubscriberOrganization:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """Organization name shown in checkout, customer portal, emails etc."""

    slug: str
    """Unique organization slug in checkout, customer portal and credit card statements."""

    avatar_url: str | None
    """Avatar URL shown in checkout, customer portal, emails etc."""

    proration_behavior: SubscriptionProrationBehavior

    allow_customer_updates: bool
    """Whether customers can update their subscriptions from the customer portal."""


@dataclasses.dataclass(kw_only=True, slots=True)
class BenefitUpdatedEvent:
    """An event created by Polar when a benefit is updated."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["benefit.updated"]
    """The name of the event."""

    metadata: BenefitGrantMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CannotCreateOrganizationError:
    error: typing.Literal["CannotCreateOrganizationError"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CardPayment:
    """Schema of a payment with a card payment method."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    processor: PaymentProcessor

    status: PaymentStatus

    amount: int
    """The payment amount in cents."""

    currency: str
    """The payment currency. Currently, only `usd` is supported."""

    method: typing.Literal["card"]
    """The payment method used."""

    trigger: PaymentTrigger | None
    """What initiated this payment attempt, e.g. initial purchase, subscription renewal, or an automated dunning retry."""

    decline_reason: str | None
    """Error code, if the payment was declined."""

    decline_message: str | None
    """Human-readable error message, if the payment was declined."""

    organization_id: str
    """The ID of the organization that owns the payment."""

    checkout_id: str | None
    """The ID of the checkout session associated with this payment."""

    order_id: str | None
    """The ID of the order associated with this payment."""

    processor_metadata: dict[str, typing.Any] | None = None
    """Additional metadata from the payment processor for internal use."""

    method_metadata: CardPaymentMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CardPaymentMetadata:
    """Additional metadata for a card payment method."""

    brand: str
    """The brand of the card used for the payment."""

    last4: str
    """The last 4 digits of the card number."""


@dataclasses.dataclass(kw_only=True, slots=True)
class Checkout:
    """Checkout session data retrieved using an access token."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    payment_processor: PaymentProcessor

    status: CheckoutStatus

    client_secret: str
    """Client secret used to update and complete the checkout session from the client."""

    url: str
    """URL where the customer can access the checkout session."""

    expires_at: str
    """Expiration date and time of the checkout session."""

    success_url: str
    """URL where the customer will be redirected after a successful payment."""

    return_url: str | None
    """When set, a back button will be shown in the checkout to return to this URL."""

    embed_origin: str | None
    """When checkout is embedded, represents the Origin of the page embedding the checkout. Used as a security measure to send messages only to the embedding page."""

    amount: int
    """Amount in cents, before discounts and taxes."""

    seats: int | None = None
    """Predefined number of seats (works with seat-based pricing only)"""

    min_seats: int | None = None
    """Minimum number of seats (works with seat-based pricing only)"""

    max_seats: int | None = None
    """Maximum number of seats (works with seat-based pricing only)"""

    discount_amount: int
    """Discount amount in cents."""

    net_amount: int
    """Amount in cents, after discounts but before taxes."""

    tax_amount: int | None
    """Sales tax amount in cents. If `null`, it means there is no enough information yet to calculate it."""

    tax_behavior: TaxBehavior | None
    """Tax behavior of the checkout. `inclusive` means the price includes tax, `exclusive` means tax is added on top. If `null`, tax is not yet calculated."""

    total_amount: int
    """Amount in cents, after discounts and taxes."""

    currency: str
    """Currency code of the checkout session."""

    allow_trial: bool | None
    """Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured."""

    active_trial_interval: TrialInterval | None
    """Interval unit of the trial period, if any. This value is either set from the checkout, if `trial_interval` is set, or from the selected product."""

    active_trial_interval_count: int | None
    """Number of interval units of the trial period, if any. This value is either set from the checkout, if `trial_interval_count` is set, or from the selected product."""

    trial_end: str | None
    """End date and time of the trial period, if any."""

    organization_id: str
    """ID of the organization owning the checkout session."""

    product_id: str | None
    """ID of the product to checkout."""

    product_price_id: str | None
    """ID of the product price to checkout."""

    discount_id: str | None
    """ID of the discount applied to the checkout."""

    allow_discount_codes: bool
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: bool
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`."""

    is_discount_applicable: bool
    """Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable."""

    is_free_product_price: bool
    """Whether the product price is free, regardless of discounts."""

    is_payment_required: bool
    """Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount."""

    is_payment_setup_required: bool
    """Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles."""

    is_payment_form_required: bool
    """Whether the checkout requires a payment form, whether because of a payment or payment method setup."""

    customer_id: str | None

    is_business_customer: bool
    """Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name."""

    customer_name: str | None
    """Name of the customer."""

    customer_email: str | None
    """Email address of the customer."""

    customer_ip_address: str | None

    customer_billing_name: str | None

    customer_billing_address: Address | None

    customer_tax_id: str | None

    locale: str | None = None

    payment_processor_metadata: dict[str, str]

    billing_address_fields: CheckoutBillingAddressFields

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    metadata: MetadataOutputType

    external_customer_id: str | None
    """ID of the customer in your system. If a matching customer exists on Polar, the resulting order will be linked to this customer. Otherwise, a new customer will be created with this external ID set."""

    products: list[CheckoutProduct]
    """List of products available to select."""

    product: CheckoutProduct | None
    """Product selected to checkout."""

    product_price: LegacyRecurringProductPrice | ProductPrice | None
    """Price of the selected product."""

    prices: dict[str, list[LegacyRecurringProductPrice | ProductPrice]] | None
    """Mapping of product IDs to their list of prices."""

    discount: (
        CheckoutDiscountFixedOnceForeverDuration
        | CheckoutDiscountFixedRepeatDuration
        | CheckoutDiscountPercentageOnceForeverDuration
        | CheckoutDiscountPercentageRepeatDuration
        | None
    )

    subscription_id: str | None

    attached_custom_fields: list[AttachedCustomField] | None

    customer_metadata: dict[str, str | int | bool]


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutBillingAddressFields:
    country: BillingAddressFieldMode

    state: BillingAddressFieldMode

    city: BillingAddressFieldMode

    postal_code: BillingAddressFieldMode

    line1: BillingAddressFieldMode

    line2: BillingAddressFieldMode


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutCreatedEvent:
    """An event created by Polar when a checkout is created."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["checkout.created"]
    """The name of the event."""

    metadata: CheckoutCreatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutCreatedMetadata:
    checkout_id: str

    checkout_status: str

    product_id: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutDiscountFixedOnceForeverDuration:
    """Schema for a fixed amount discount that is applied once or forever."""

    duration: DiscountDuration

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    id: str
    """The ID of the object."""

    name: str

    code: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutDiscountFixedRepeatDuration:
    """Schema for a fixed amount discount that is applied on every invoice
    for a certain number of months."""

    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    id: str
    """The ID of the object."""

    name: str

    code: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutDiscountPercentageOnceForeverDuration:
    """Schema for a percentage discount that is applied once or forever."""

    duration: DiscountDuration

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    id: str
    """The ID of the object."""

    name: str

    code: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutDiscountPercentageRepeatDuration:
    """Schema for a percentage discount that is applied on every invoice
    for a certain number of months."""

    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    id: str
    """The ID of the object."""

    name: str

    code: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutLink:
    """Checkout link data."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    metadata: MetadataOutputType

    payment_processor: PaymentProcessor

    client_secret: str
    """Client secret used to access the checkout link."""

    success_url: str | None
    """URL where the customer will be redirected after a successful payment."""

    return_url: str | None
    """When set, a back button will be shown in the checkout to return to this URL."""

    label: str | None
    """Optional label to distinguish links internally"""

    allow_discount_codes: bool
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: bool
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting."""

    discount_id: str | None
    """ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored."""

    seats: int | None
    """Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored."""

    organization_id: str
    """The organization ID."""

    products: list[CheckoutLinkProduct]

    discount: (
        DiscountFixedOnceForeverDurationBase
        | DiscountFixedRepeatDurationBase
        | DiscountPercentageOnceForeverDurationBase
        | DiscountPercentageRepeatDurationBase
        | None
    )

    url: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutLinkProduct:
    """Product data for a checkout link."""

    metadata: MetadataOutputType

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of prices for this product."""

    benefits: list[BenefitPublic]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """List of medias associated to the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutOrganization:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """Organization name shown in checkout, customer portal, emails etc."""

    slug: str
    """Unique organization slug in checkout, customer portal and credit card statements."""

    avatar_url: str | None
    """Avatar URL shown in checkout, customer portal, emails etc."""

    proration_behavior: SubscriptionProrationBehavior

    allow_customer_updates: bool
    """Whether customers can update their subscriptions from the customer portal."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutProduct:
    """Product data for a checkout session."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of prices for this product."""

    benefits: list[BenefitPublic]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """List of medias associated to the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutPublic:
    """Checkout session data retrieved using the client secret."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    payment_processor: PaymentProcessor

    status: CheckoutStatus

    client_secret: str
    """Client secret used to update and complete the checkout session from the client."""

    url: str
    """URL where the customer can access the checkout session."""

    expires_at: str
    """Expiration date and time of the checkout session."""

    success_url: str
    """URL where the customer will be redirected after a successful payment."""

    return_url: str | None
    """When set, a back button will be shown in the checkout to return to this URL."""

    embed_origin: str | None
    """When checkout is embedded, represents the Origin of the page embedding the checkout. Used as a security measure to send messages only to the embedding page."""

    amount: int
    """Amount in cents, before discounts and taxes."""

    seats: int | None = None
    """Predefined number of seats (works with seat-based pricing only)"""

    min_seats: int | None = None
    """Minimum number of seats (works with seat-based pricing only)"""

    max_seats: int | None = None
    """Maximum number of seats (works with seat-based pricing only)"""

    discount_amount: int
    """Discount amount in cents."""

    net_amount: int
    """Amount in cents, after discounts but before taxes."""

    tax_amount: int | None
    """Sales tax amount in cents. If `null`, it means there is no enough information yet to calculate it."""

    tax_behavior: TaxBehavior | None
    """Tax behavior of the checkout. `inclusive` means the price includes tax, `exclusive` means tax is added on top. If `null`, tax is not yet calculated."""

    total_amount: int
    """Amount in cents, after discounts and taxes."""

    currency: str
    """Currency code of the checkout session."""

    allow_trial: bool | None
    """Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured."""

    active_trial_interval: TrialInterval | None
    """Interval unit of the trial period, if any. This value is either set from the checkout, if `trial_interval` is set, or from the selected product."""

    active_trial_interval_count: int | None
    """Number of interval units of the trial period, if any. This value is either set from the checkout, if `trial_interval_count` is set, or from the selected product."""

    trial_end: str | None
    """End date and time of the trial period, if any."""

    organization_id: str
    """ID of the organization owning the checkout session."""

    product_id: str | None
    """ID of the product to checkout."""

    product_price_id: str | None
    """ID of the product price to checkout."""

    discount_id: str | None
    """ID of the discount applied to the checkout."""

    allow_discount_codes: bool
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: bool
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`."""

    is_discount_applicable: bool
    """Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable."""

    is_free_product_price: bool
    """Whether the product price is free, regardless of discounts."""

    is_payment_required: bool
    """Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount."""

    is_payment_setup_required: bool
    """Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles."""

    is_payment_form_required: bool
    """Whether the checkout requires a payment form, whether because of a payment or payment method setup."""

    customer_id: str | None

    is_business_customer: bool
    """Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name."""

    customer_name: str | None
    """Name of the customer."""

    customer_email: str | None
    """Email address of the customer."""

    customer_ip_address: str | None

    customer_billing_name: str | None

    customer_billing_address: Address | None

    customer_tax_id: str | None

    locale: str | None = None

    payment_processor_metadata: dict[str, str]

    billing_address_fields: CheckoutBillingAddressFields

    products: list[CheckoutProduct]
    """List of products available to select."""

    product: CheckoutProduct | None
    """Product selected to checkout."""

    product_price: LegacyRecurringProductPrice | ProductPrice | None
    """Price of the selected product."""

    prices: dict[str, list[LegacyRecurringProductPrice | ProductPrice]] | None
    """Mapping of product IDs to their list of prices."""

    discount: (
        CheckoutDiscountFixedOnceForeverDuration
        | CheckoutDiscountFixedRepeatDuration
        | CheckoutDiscountPercentageOnceForeverDuration
        | CheckoutDiscountPercentageRepeatDuration
        | None
    )

    organization: CheckoutOrganization

    attached_custom_fields: list[AttachedCustomField] | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CheckoutPublicConfirmed:
    """Checkout session data retrieved using the client secret after confirmation.

    It contains a customer session token to retrieve order information
    right after the checkout."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    payment_processor: PaymentProcessor

    status: typing.Literal["confirmed"]

    client_secret: str
    """Client secret used to update and complete the checkout session from the client."""

    url: str
    """URL where the customer can access the checkout session."""

    expires_at: str
    """Expiration date and time of the checkout session."""

    success_url: str
    """URL where the customer will be redirected after a successful payment."""

    return_url: str | None
    """When set, a back button will be shown in the checkout to return to this URL."""

    embed_origin: str | None
    """When checkout is embedded, represents the Origin of the page embedding the checkout. Used as a security measure to send messages only to the embedding page."""

    amount: int
    """Amount in cents, before discounts and taxes."""

    seats: int | None = None
    """Predefined number of seats (works with seat-based pricing only)"""

    min_seats: int | None = None
    """Minimum number of seats (works with seat-based pricing only)"""

    max_seats: int | None = None
    """Maximum number of seats (works with seat-based pricing only)"""

    discount_amount: int
    """Discount amount in cents."""

    net_amount: int
    """Amount in cents, after discounts but before taxes."""

    tax_amount: int | None
    """Sales tax amount in cents. If `null`, it means there is no enough information yet to calculate it."""

    tax_behavior: TaxBehavior | None
    """Tax behavior of the checkout. `inclusive` means the price includes tax, `exclusive` means tax is added on top. If `null`, tax is not yet calculated."""

    total_amount: int
    """Amount in cents, after discounts and taxes."""

    currency: str
    """Currency code of the checkout session."""

    allow_trial: bool | None
    """Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured."""

    active_trial_interval: TrialInterval | None
    """Interval unit of the trial period, if any. This value is either set from the checkout, if `trial_interval` is set, or from the selected product."""

    active_trial_interval_count: int | None
    """Number of interval units of the trial period, if any. This value is either set from the checkout, if `trial_interval_count` is set, or from the selected product."""

    trial_end: str | None
    """End date and time of the trial period, if any."""

    organization_id: str
    """ID of the organization owning the checkout session."""

    product_id: str | None
    """ID of the product to checkout."""

    product_price_id: str | None
    """ID of the product price to checkout."""

    discount_id: str | None
    """ID of the discount applied to the checkout."""

    allow_discount_codes: bool
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: bool
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`."""

    is_discount_applicable: bool
    """Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable."""

    is_free_product_price: bool
    """Whether the product price is free, regardless of discounts."""

    is_payment_required: bool
    """Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount."""

    is_payment_setup_required: bool
    """Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles."""

    is_payment_form_required: bool
    """Whether the checkout requires a payment form, whether because of a payment or payment method setup."""

    customer_id: str | None

    is_business_customer: bool
    """Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name."""

    customer_name: str | None
    """Name of the customer."""

    customer_email: str | None
    """Email address of the customer."""

    customer_ip_address: str | None

    customer_billing_name: str | None

    customer_billing_address: Address | None

    customer_tax_id: str | None

    locale: str | None = None

    payment_processor_metadata: dict[str, str]

    billing_address_fields: CheckoutBillingAddressFields

    products: list[CheckoutProduct]
    """List of products available to select."""

    product: CheckoutProduct | None
    """Product selected to checkout."""

    product_price: LegacyRecurringProductPrice | ProductPrice | None
    """Price of the selected product."""

    prices: dict[str, list[LegacyRecurringProductPrice | ProductPrice]] | None
    """Mapping of product IDs to their list of prices."""

    discount: (
        CheckoutDiscountFixedOnceForeverDuration
        | CheckoutDiscountFixedRepeatDuration
        | CheckoutDiscountPercentageOnceForeverDuration
        | CheckoutDiscountPercentageRepeatDuration
        | None
    )

    organization: CheckoutOrganization

    attached_custom_fields: list[AttachedCustomField] | None

    customer_session_token: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class Context: ...


@dataclasses.dataclass(kw_only=True, slots=True)
class CostMetadataOutput:
    amount: str
    """The amount in cents."""

    currency: str
    """The currency. Currently, only `usd` is supported."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CountAggregation:
    func: typing.Literal["count"] = "count"


@dataclasses.dataclass(kw_only=True, slots=True)
class CursorPagination:
    has_next_page: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldCheckbox:
    """Schema for a custom field of type checkbox."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    type: typing.Literal["checkbox"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value."""

    name: str
    """Name of the custom field."""

    organization_id: str
    """The ID of the organization owning the custom field."""

    properties: CustomFieldCheckboxProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldCheckboxProperties:
    form_label: str | None = None

    form_help_text: str | None = None

    form_placeholder: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldDate:
    """Schema for a custom field of type date."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    type: typing.Literal["date"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value."""

    name: str
    """Name of the custom field."""

    organization_id: str
    """The ID of the organization owning the custom field."""

    properties: CustomFieldDateProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldDateProperties:
    form_label: str | None = None

    form_help_text: str | None = None

    form_placeholder: str | None = None

    ge: int | None = None

    le: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldNumber:
    """Schema for a custom field of type number."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    type: typing.Literal["number"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value."""

    name: str
    """Name of the custom field."""

    organization_id: str
    """The ID of the organization owning the custom field."""

    properties: CustomFieldNumberProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldNumberProperties:
    form_label: str | None = None

    form_help_text: str | None = None

    form_placeholder: str | None = None

    ge: int | None = None

    le: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldSelect:
    """Schema for a custom field of type select."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    type: typing.Literal["select"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value."""

    name: str
    """Name of the custom field."""

    organization_id: str
    """The ID of the organization owning the custom field."""

    properties: CustomFieldSelectProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldSelectOption:
    value: str

    label: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldSelectProperties:
    form_label: str | None = None

    form_help_text: str | None = None

    form_placeholder: str | None = None

    options: list[CustomFieldSelectOption]


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldText:
    """Schema for a custom field of type text."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    type: typing.Literal["text"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value."""

    name: str
    """Name of the custom field."""

    organization_id: str
    """The ID of the organization owning the custom field."""

    properties: CustomFieldTextProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomFieldTextProperties:
    form_label: str | None = None

    form_help_text: str | None = None

    form_placeholder: str | None = None

    textarea: bool | None = None

    min_length: int | None = None

    max_length: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantCustom:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitCustomSubscriber

    properties: BenefitGrantCustomProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantDiscord:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitDiscordSubscriber

    properties: BenefitGrantDiscordProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantDownloadables:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitDownloadablesSubscriber

    properties: BenefitGrantDownloadablesProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantFeatureFlag:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitFeatureFlagSubscriber

    properties: BenefitGrantFeatureFlagProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantGitHubRepository:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitGitHubRepositorySubscriber

    properties: BenefitGrantGitHubRepositoryProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantLicenseKeys:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitLicenseKeysSubscriber

    properties: BenefitGrantLicenseKeysProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantMeterCredit:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitMeterCreditSubscriber

    properties: BenefitGrantMeterCreditProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerBenefitGrantSlackSharedChannel:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    granted_at: str | None

    revoked_at: str | None

    customer_id: str

    member_id: str | None = None

    benefit_id: str

    subscription_id: str | None

    order_id: str | None

    is_granted: bool

    is_revoked: bool

    error: BenefitGrantError | None = None

    customer: CustomerPortalCustomer

    benefit: BenefitSlackSharedChannelSubscriber

    properties: BenefitGrantSlackSharedChannelProperties


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerCreatedEvent:
    """An event created by Polar when a customer is created."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["customer.created"]
    """The name of the event."""

    metadata: CustomerCreatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerCreatedMetadata:
    customer_id: str

    customer_email: str | None

    customer_name: str | None

    customer_external_id: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerCustomerMeter:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    customer_id: str
    """The ID of the customer."""

    meter_id: str
    """The ID of the meter."""

    consumed_units: float
    """The number of consumed units."""

    credited_units: int
    """The number of credited units."""

    balance: float
    """The balance of the meter, i.e. the difference between credited and consumed units."""

    meter: CustomerCustomerMeterMeter


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerCustomerMeterMeter:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """The name of the meter. Will be shown on customer's invoices and usage."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerCustomerSession:
    expires_at: str

    return_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerDeletedEvent:
    """An event created by Polar when a customer is deleted."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["customer.deleted"]
    """The name of the event."""

    metadata: CustomerDeletedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerDeletedMetadata:
    customer_id: str

    customer_email: str | None

    customer_name: str | None

    customer_external_id: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerEmailUpdateVerifyResponse:
    token: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerIndividual:
    """A customer in an organization."""

    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: typing.Literal["individual"]
    """The type of customer."""

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerMeter:
    """An active customer meter, with current consumed and credited units."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    customer_id: str
    """The ID of the customer."""

    meter_id: str
    """The ID of the meter."""

    consumed_units: float
    """The number of consumed units."""

    credited_units: int
    """The number of credited units."""

    balance: float
    """The balance of the meter, i.e. the difference between credited and consumed units."""

    customer: Customer

    meter: Meter


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerNotReady:
    error: typing.Literal["CustomerNotReady"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrder:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    status: OrderStatus

    paid: bool
    """Whether the order has been paid for."""

    subtotal_amount: int
    """Amount in cents, before discounts and taxes."""

    discount_amount: int
    """Discount amount in cents."""

    net_amount: int
    """Amount in cents, after discounts but before taxes."""

    tax_amount: int
    """Sales tax amount in cents."""

    total_amount: int
    """Amount in cents, after discounts and taxes."""

    applied_balance_amount: int
    """Customer's balance amount applied to this invoice. Can increase the total amount paid, if the customer has a negative balance,  or decrease it, if the customer has a positive balance.Amount in cents."""

    due_amount: int
    """Amount in cents that is due for this order."""

    refunded_amount: int
    """Amount refunded in cents."""

    refunded_tax_amount: int
    """Sales tax refunded in cents."""

    currency: str

    billing_reason: OrderBillingReason

    billing_name: str | None
    """The name of the customer that should appear on the invoice. """

    billing_address: Address | None

    invoice_number: str | None
    """The invoice number associated with this order. `null` while the order is in `draft` status; assigned at finalize."""

    is_invoice_generated: bool
    """Whether an invoice has been generated for this order."""

    receipt_number: str | None
    """The receipt number for this order. Set once the order is paid for organizations with receipts enabled. When set, a downloadable receipt PDF can be obtained via the receipt endpoint."""

    seats: int | None = None
    """Number of seats purchased (for seat-based one-time orders)."""

    customer_id: str

    product_id: str | None

    discount_id: str | None

    subscription_id: str | None

    checkout_id: str | None

    next_payment_attempt_at: str | None = None
    """When the next automatic payment retry is scheduled. `null` if the order is not in dunning or all retries have been exhausted."""

    product: CustomerOrderProduct | None

    subscription: CustomerOrderSubscription | None

    items: list[OrderItemSchema]
    """Line items composing the order."""

    description: str
    """A summary description of the order."""

    refundable_amount: int
    """Amount in cents that can still be refunded (net, before taxes). Accounts for any applied customer balance and previous refunds."""

    refundable_tax_amount: int
    """Sales tax in cents that would be refunded if the full refundable amount is refunded."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderInvoice:
    """Order's invoice data."""

    url: str
    """The URL to the invoice."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderPaymentConfirmation:
    """Response after confirming a retry payment."""

    status: str
    """Payment status after confirmation."""

    client_secret: str | None = None
    """Client secret for handling additional actions."""

    error: str | None = None
    """Error message if confirmation failed."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderPaymentStatus:
    """Payment status for an order."""

    status: str
    """Current payment status."""

    error: str | None = None
    """Error message if payment failed."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderProduct:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of prices for this product."""

    benefits: list[BenefitPublic]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """List of medias associated to the product."""

    organization: CustomerOrganization


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderReceipt:
    """Order's receipt data."""

    url: str
    """The URL to the receipt PDF."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrderSubscription:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    amount: int
    """The amount of the subscription."""

    currency: str
    """The currency of the subscription."""

    recurring_interval: RecurringInterval

    recurring_interval_count: int
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on."""

    status: SubscriptionStatus

    current_period_start: str
    """The start timestamp of the current billing period."""

    current_period_end: str
    """The end timestamp of the current billing period."""

    current_meter_period_start: str | None
    """The start timestamp of the current meter period, if the product has a meter cycle set. Metered credits are granted and overage is settled on this cadence."""

    current_meter_period_end: str | None
    """The end timestamp of the current meter period, if the product has a meter cycle set. This is when credits next renew."""

    trial_start: str | None
    """The start timestamp of the trial period, if any."""

    trial_end: str | None
    """The end timestamp of the trial period, if any."""

    cancel_at_period_end: bool
    """Whether the subscription will be canceled at the end of the current period."""

    canceled_at: str | None
    """The timestamp when the subscription was canceled. The subscription might still be active if `cancel_at_period_end` is `true`."""

    started_at: str | None
    """The timestamp when the subscription started."""

    ends_at: str | None
    """The timestamp when the subscription will end."""

    ended_at: str | None
    """The timestamp when the subscription ended."""

    past_due_at: str | None = None
    """The timestamp when the subscription entered `past_due` status."""

    pause_at_period_end: bool
    """Whether the subscription will be paused at the end of the current period."""

    paused_at: str | None
    """The timestamp when the subscription was paused."""

    resumes_at: str | None
    """The timestamp when a paused subscription is scheduled to automatically resume, if set."""

    customer_id: str
    """The ID of the subscribed customer."""

    product_id: str
    """The ID of the subscribed product."""

    discount_id: str | None
    """The ID of the applied discount, if any."""

    checkout_id: str | None

    seats: int | None = None
    """The number of seats for seat-based subscriptions. None for non-seat subscriptions."""

    customer_cancellation_reason: CustomerCancellationReason | None

    customer_cancellation_comment: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrganization:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """Organization name shown in checkout, customer portal, emails etc."""

    slug: str
    """Unique organization slug in checkout, customer portal and credit card statements."""

    avatar_url: str | None
    """Avatar URL shown in checkout, customer portal, emails etc."""

    proration_behavior: SubscriptionProrationBehavior

    allow_customer_updates: bool
    """Whether customers can update their subscriptions from the customer portal."""

    customer_portal_settings: OrganizationCustomerPortalSettings

    organization_features: CustomerOrganizationFeatureSettings | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrganizationData:
    """Schema of an organization and related data for customer portal."""

    organization: CustomerOrganization

    products: list[CustomerProduct]


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerOrganizationFeatureSettings:
    """Feature flags exposed to the customer portal."""

    member_model_enabled: bool = False
    """Whether the member model is enabled for this organization."""

    checkout_localization_enabled: bool = False
    """Whether localization is enabled for this organization."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPaymentMethodCard:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    processor: PaymentProcessor

    customer_id: str

    type: typing.Literal["card"]

    method_metadata: PaymentMethodCardMetadata

    is_default: bool
    """Whether this payment method is the customer's default payment method."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPaymentMethodCreateRequiresActionResponse:
    status: typing.Literal["requires_action"]

    client_secret: str


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPaymentMethodCreateSucceededResponse:
    status: typing.Literal["succeeded"]

    payment_method: CustomerPaymentMethod


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPaymentMethodGeneric:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    processor: PaymentProcessor

    customer_id: str

    type: str

    is_default: bool
    """Whether this payment method is the customer's default payment method."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalCustomer:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    email: str | None

    email_verified: bool

    name: str | None

    billing_name: str | None

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    oauth_accounts: dict[str, CustomerPortalOAuthAccount]

    default_payment_method_id: str | None = None

    type: CustomerType | None = None

    locale: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalCustomerSettings:
    allow_email_change: bool | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalMember:
    """A member of the customer's team as seen in the customer portal."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    email: str
    """The email address of the member."""

    name: str | None
    """The name of the member."""

    role: MemberRole


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalOAuthAccount:
    account_id: str

    account_username: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalSubscriptionSettings:
    update_seats: bool

    update_plan: bool

    pause: bool | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerPortalUsageSettings:
    show: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerProduct:
    """Schema of a product for customer portal."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of available prices for this product."""

    benefits: list[BenefitPublic]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """The medias associated to the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSeat:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The seat ID"""

    subscription_id: str | None
    """The subscription ID (for recurring seats)"""

    order_id: str | None
    """The order ID (for one-time purchase seats)"""

    status: SeatStatus

    customer_id: str | None
    """The customer ID. When member_model_enabled is true, this is the billing customer (purchaser). When false, this is the seat member customer."""

    member_id: str | None
    """The member ID of the seat occupant"""

    member: Member | None
    """The member associated with this seat"""

    email: str | None
    """Email of the seat member (set when member_model_enabled is true)"""

    customer_email: str | None
    """The assigned customer email"""

    invitation_token_expires_at: str | None
    """When the invitation token expires"""

    claimed_at: str | None
    """When the seat was claimed"""

    revoked_at: str | None
    """When the seat was revoked"""

    seat_metadata: dict[str, typing.Any] | None
    """Additional metadata for the seat"""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSeatClaimResponse:
    """Response after successfully claiming a seat."""

    seat: CustomerSeat

    customer_session_token: str
    """Session token for immediate customer portal access"""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSession:
    """A customer session that can be used to authenticate as a customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    token: str

    expires_at: str

    return_url: str | None

    customer_portal_url: str

    customer_id: str

    customer: Customer


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateBenefitGrant:
    """An active benefit grant for a customer."""

    id: str
    """The ID of the grant."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    granted_at: str
    """The timestamp when the benefit was granted."""

    benefit_id: str
    """The ID of the benefit concerned by this grant."""

    benefit_type: BenefitType

    benefit_metadata: MetadataOutputType

    properties: (
        BenefitGrantDiscordProperties
        | BenefitGrantGitHubRepositoryProperties
        | BenefitGrantDownloadablesProperties
        | BenefitGrantLicenseKeysProperties
        | BenefitGrantCustomProperties
        | BenefitGrantFeatureFlagProperties
        | BenefitGrantSlackSharedChannelProperties
    )


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateIndividual:
    """A customer along with additional state information:

    * Active subscriptions
    * Granted benefits
    * Active meters"""

    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: typing.Literal["individual"]
    """The type of customer."""

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None

    active_subscriptions: list[CustomerStateSubscription]
    """The customer's active subscriptions."""

    granted_benefits: list[CustomerStateBenefitGrant]
    """The customer's active benefit grants."""

    active_meters: list[CustomerStateMeter]
    """The customer's active meters."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateMeter:
    """An active meter for a customer, with latest consumed and credited units."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    meter_id: str
    """The ID of the meter."""

    consumed_units: float
    """The number of consumed units."""

    credited_units: int
    """The number of credited units."""

    balance: float
    """The balance of the meter, i.e. the difference between credited and consumed units."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateSubscription:
    """An active customer subscription."""

    id: str
    """The ID of the subscription."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    metadata: MetadataOutputType

    status: Status

    amount: int
    """The amount of the subscription."""

    currency: str
    """The currency of the subscription."""

    recurring_interval: RecurringInterval

    current_period_start: str
    """The start timestamp of the current billing period."""

    current_period_end: str
    """The end timestamp of the current billing period."""

    trial_start: str | None
    """The start timestamp of the trial period, if any."""

    trial_end: str | None
    """The end timestamp of the trial period, if any."""

    cancel_at_period_end: bool
    """Whether the subscription will be canceled at the end of the current period."""

    canceled_at: str | None
    """The timestamp when the subscription was canceled. The subscription might still be active if `cancel_at_period_end` is `true`."""

    started_at: str | None
    """The timestamp when the subscription started."""

    ends_at: str | None
    """The timestamp when the subscription will end."""

    product_id: str
    """The ID of the subscribed product."""

    discount_id: str | None
    """The ID of the applied discount, if any."""

    meters: list[CustomerStateSubscriptionMeter]
    """List of meters associated with the subscription."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateSubscriptionMeter:
    """Current consumption and spending for a subscription meter."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    consumed_units: float
    """The number of consumed units so far in this billing period."""

    credited_units: int
    """The number of credited units so far in this billing period."""

    amount: int
    """The amount due in cents so far in this billing period."""

    meter_id: str
    """The ID of the meter."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerStateTeam:
    """A team customer along with additional state information:

    * Active subscriptions
    * Granted benefits
    * Active meters"""

    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: typing.Literal["team"]
    """The type of customer. Team customers can have multiple members."""

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None

    active_subscriptions: list[CustomerStateSubscription]
    """The customer's active subscriptions."""

    granted_benefits: list[CustomerStateBenefitGrant]
    """The customer's active benefit grants."""

    active_meters: list[CustomerStateMeter]
    """The customer's active meters."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSubscription:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    amount: int
    """The amount of the subscription."""

    currency: str
    """The currency of the subscription."""

    recurring_interval: RecurringInterval

    recurring_interval_count: int
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on."""

    status: SubscriptionStatus

    current_period_start: str
    """The start timestamp of the current billing period."""

    current_period_end: str
    """The end timestamp of the current billing period."""

    current_meter_period_start: str | None
    """The start timestamp of the current meter period, if the product has a meter cycle set. Metered credits are granted and overage is settled on this cadence."""

    current_meter_period_end: str | None
    """The end timestamp of the current meter period, if the product has a meter cycle set. This is when credits next renew."""

    trial_start: str | None
    """The start timestamp of the trial period, if any."""

    trial_end: str | None
    """The end timestamp of the trial period, if any."""

    cancel_at_period_end: bool
    """Whether the subscription will be canceled at the end of the current period."""

    canceled_at: str | None
    """The timestamp when the subscription was canceled. The subscription might still be active if `cancel_at_period_end` is `true`."""

    started_at: str | None
    """The timestamp when the subscription started."""

    ends_at: str | None
    """The timestamp when the subscription will end."""

    ended_at: str | None
    """The timestamp when the subscription ended."""

    past_due_at: str | None = None
    """The timestamp when the subscription entered `past_due` status."""

    pause_at_period_end: bool
    """Whether the subscription will be paused at the end of the current period."""

    paused_at: str | None
    """The timestamp when the subscription was paused."""

    resumes_at: str | None
    """The timestamp when a paused subscription is scheduled to automatically resume, if set."""

    customer_id: str
    """The ID of the subscribed customer."""

    product_id: str
    """The ID of the subscribed product."""

    discount_id: str | None
    """The ID of the applied discount, if any."""

    checkout_id: str | None

    seats: int | None = None
    """The number of seats for seat-based subscriptions. None for non-seat subscriptions."""

    customer_cancellation_reason: CustomerCancellationReason | None

    customer_cancellation_comment: str | None

    product: CustomerSubscriptionProduct

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of enabled prices for the subscription."""

    meters: list[CustomerSubscriptionMeter]
    """List of meters associated with the subscription."""

    pending_update: PendingSubscriptionUpdate | None
    """Pending subscription update that will be applied at the beginning of the next period. If `null`, there is no pending update."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSubscriptionMeter:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    consumed_units: float
    """The number of consumed units so far in this billing period."""

    credited_units: int
    """The number of credited units so far in this billing period."""

    amount: int
    """The amount due in cents so far in this billing period."""

    meter_id: str
    """The ID of the meter."""

    meter: CustomerSubscriptionMeterMeter


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSubscriptionMeterMeter:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """The name of the meter. Will be shown on customer's invoices and usage."""


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerSubscriptionProduct:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of prices for this product."""

    benefits: list[BenefitPublic]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """List of medias associated to the product."""

    organization: CustomerOrganization


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerTeam:
    """A team customer in an organization."""

    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: typing.Literal["team"]
    """The type of customer. Team customers can have multiple members."""

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerUpdatedEvent:
    """An event created by Polar when a customer is updated."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["customer.updated"]
    """The name of the event."""

    metadata: CustomerUpdatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerUpdatedFields:
    name: str | None = None

    billing_name: str | None = None

    email: str | None = None

    billing_address: AddressDict | None = None

    tax_id: str | None = None

    metadata: dict[str, str | int | bool] | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerUpdatedMetadata:
    customer_id: str

    customer_email: str | None

    customer_name: str | None

    customer_external_id: str | None

    updated_fields: CustomerUpdatedFields


@dataclasses.dataclass(kw_only=True, slots=True)
class CustomerWallet:
    """A wallet represents your balance with an organization.

    You can top-up your wallet and use the balance to pay for usage."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    customer_id: str
    """The ID of the customer that owns the wallet."""

    balance: int
    """The current balance of the wallet, in cents."""

    currency: str
    """The currency of the wallet."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountFixedOnceForeverDuration:
    """Schema for a fixed amount discount that is applied once or forever."""

    duration: DiscountDuration

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""

    products: list[DiscountProduct]


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountFixedOnceForeverDurationBase:
    duration: DiscountDuration

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountFixedRepeatDuration:
    """Schema for a fixed amount discount that is applied on every invoice
    for a certain number of months."""

    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""

    products: list[DiscountProduct]


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountFixedRepeatDurationBase:
    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    amount: int

    currency: str

    amounts: dict[str, int]
    """Map of currency to fixed amount to discount from the total."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountPercentageOnceForeverDuration:
    """Schema for a percentage discount that is applied once or forever."""

    duration: DiscountDuration

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""

    products: list[DiscountProduct]


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountPercentageOnceForeverDurationBase:
    duration: DiscountDuration

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountPercentageRepeatDuration:
    """Schema for a percentage discount that is applied on every invoice
    for a certain number of months."""

    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""

    products: list[DiscountProduct]


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountPercentageRepeatDurationBase:
    duration: DiscountDuration

    duration_in_months: int

    type: DiscountType

    basis_points: int
    """Discount percentage in basis points. A basis point is 1/100th of a percent. For example, 1000 basis points equals a 10% discount."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: str | None
    """Code customers can use to apply the discount during checkout."""

    starts_at: str | None
    """Timestamp after which the discount is redeemable."""

    ends_at: str | None
    """Timestamp after which the discount is no longer redeemable."""

    max_redemptions: int | None
    """Maximum number of times the discount can be redeemed."""

    redemptions_count: int
    """Number of times the discount has been redeemed."""

    organization_id: str
    """The organization ID."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DiscountProduct:
    """A product that a discount can be applied to."""

    metadata: MetadataOutputType

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class Dispute:
    """Schema representing a dispute.

    A dispute is a challenge raised by a customer or their bank regarding a payment."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    status: DisputeStatus

    resolved: bool
    """Whether the dispute has been resolved (won or lost)."""

    closed: bool
    """Whether the dispute is closed (prevented, won, or lost)."""

    amount: int
    """Amount in cents disputed."""

    tax_amount: int
    """Tax amount in cents disputed."""

    currency: str
    """Currency code of the dispute."""

    reason: str | None
    """The reason for the dispute as reported by the card network (e.g. `fraudulent`, `product_not_received`). `None` until the processor reports it."""

    evidence_due_by: str | None
    """Deadline to submit evidence in response to the dispute. `None` when no response is required."""

    past_due: bool
    """Whether the evidence submission deadline has passed."""

    order_id: str
    """The ID of the order associated with the dispute."""

    payment_id: str
    """The ID of the payment associated with the dispute."""

    customer: DisputeCustomer

    case_id: str | None
    """The ID of the support case for this dispute, if one was opened."""


@dataclasses.dataclass(kw_only=True, slots=True)
class DisputeCustomer:
    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: CustomerType

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class DisputeNotOpenError:
    error: typing.Literal["DisputeNotOpenError"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class DownloadableFileRead:
    """File to be associated with the downloadables benefit."""

    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    version: str | None

    service: typing.Literal["downloadable"]

    is_uploaded: bool

    created_at: str

    size_readable: str


@dataclasses.dataclass(kw_only=True, slots=True)
class DownloadableRead:
    id: str

    benefit_id: str

    file: FileDownload


@dataclasses.dataclass(kw_only=True, slots=True)
class EventMetadataOutput:
    _cost: CostMetadataOutput | None = None

    _llm: LLMMetadata | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class EventName:
    name: str
    """The name of the event."""

    label: str
    """Human readable label of the event."""

    source: EventSource

    occurrences: int
    """Number of times the event has occurred."""

    first_seen: str
    """The first time the event occurred."""

    last_seen: str
    """The last time the event occurred."""


@dataclasses.dataclass(kw_only=True, slots=True)
class EventType:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """The name of the event type."""

    label: str
    """The label for the event type."""

    label_property_selector: str | None = None
    """Property path to extract dynamic label from event metadata."""

    organization_id: str
    """The ID of the organization owning the event type."""


@dataclasses.dataclass(kw_only=True, slots=True)
class EventTypeWithStats:
    id: str | None = None
    """The ID of the event type. Null for system event types."""

    created_at: str | None = None
    """Creation timestamp of the event type. Null for system event types."""

    modified_at: str | None = None
    """Last modification timestamp of the event type. Null for system event types."""

    name: str
    """The name of the event type."""

    label: str
    """The label for the event type."""

    label_property_selector: str | None = None
    """Property path to extract dynamic label from event metadata."""

    organization_id: str
    """The ID of the organization owning the event type."""

    source: EventSource

    occurrences: int
    """Number of times the event has occurred."""

    first_seen: str
    """The first time the event occurred."""

    last_seen: str
    """The last time the event occurred."""


@dataclasses.dataclass(kw_only=True, slots=True)
class EventsIngestResponse:
    inserted: int
    """Number of events inserted."""

    duplicates: int = 0
    """Number of duplicate events skipped."""


@dataclasses.dataclass(kw_only=True, slots=True)
class ExpiredCheckoutError:
    error: typing.Literal["ExpiredCheckoutError"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class FileDownload:
    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    download: S3DownloadURL

    version: str | None

    is_uploaded: bool

    service: FileServiceTypes

    size_readable: str


@dataclasses.dataclass(kw_only=True, slots=True)
class FileUpload:
    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    upload: S3FileUploadMultipart

    version: str | None

    is_uploaded: bool = False

    service: FileServiceTypes

    size_readable: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Filter:
    conjunction: FilterConjunction

    clauses: list[FilterClause | Filter]


@dataclasses.dataclass(kw_only=True, slots=True)
class FilterClause:
    property: str

    operator: FilterOperator

    value: str | int | bool


@dataclasses.dataclass(kw_only=True, slots=True)
class GenericPayment:
    """Schema of a payment with a generic payment method."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    processor: PaymentProcessor

    status: PaymentStatus

    amount: int
    """The payment amount in cents."""

    currency: str
    """The payment currency. Currently, only `usd` is supported."""

    method: str
    """The payment method used."""

    trigger: PaymentTrigger | None
    """What initiated this payment attempt, e.g. initial purchase, subscription renewal, or an automated dunning retry."""

    decline_reason: str | None
    """Error code, if the payment was declined."""

    decline_message: str | None
    """Human-readable error message, if the payment was declined."""

    organization_id: str
    """The ID of the organization that owns the payment."""

    checkout_id: str | None
    """The ID of the checkout session associated with this payment."""

    order_id: str | None
    """The ID of the order associated with this payment."""

    processor_metadata: dict[str, typing.Any] | None = None
    """Additional metadata from the payment processor for internal use."""


@dataclasses.dataclass(kw_only=True, slots=True)
class HTTPValidationError:
    detail: list[ValidationError] | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class IntrospectTokenResponse:
    active: bool

    client_id: str

    token_type: TokenType

    scope: str

    sub_type: SubType

    sub: str

    organizations: list[str]

    aud: str

    iss: str

    exp: int

    iat: int


@dataclasses.dataclass(kw_only=True, slots=True)
class LLMMetadata:
    vendor: str
    """The vendor of the event."""

    model: str
    """The model used for the event."""

    prompt: str | None = None
    """The LLM prompt used for the event."""

    response: str | None = None
    """The LLM response used for the event."""

    input_tokens: int
    """The number of LLM input tokens used for the event."""

    cached_input_tokens: int | None = None
    """The number of LLM cached tokens that were used for the event."""

    output_tokens: int
    """The number of LLM output tokens used for the event."""

    total_tokens: int
    """The total number of LLM tokens used for the event."""


@dataclasses.dataclass(kw_only=True, slots=True)
class LegacyRecurringProductPriceCustom:
    """A pay-what-you-want recurring price for a product, i.e. a subscription.

    **Deprecated**: The recurring interval should be set on the product itself."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["custom"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    type: typing.Literal["recurring"]
    """The type of the price."""

    recurring_interval: RecurringInterval

    minimum_amount: int
    """The minimum amount the customer can pay. If 0, the price is 'free or pay what you want'."""

    maximum_amount: int | None
    """The maximum amount the customer can pay."""

    preset_amount: int | None
    """The initial amount shown to the customer."""

    legacy: typing.Literal[True]


@dataclasses.dataclass(kw_only=True, slots=True)
class LegacyRecurringProductPriceFixed:
    """A recurring price for a product, i.e. a subscription.

    **Deprecated**: The recurring interval should be set on the product itself."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["fixed"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    type: typing.Literal["recurring"]
    """The type of the price."""

    recurring_interval: RecurringInterval

    price_amount: int
    """The price in cents."""

    legacy: typing.Literal[True]


@dataclasses.dataclass(kw_only=True, slots=True)
class LicenseKeyActivationBase:
    id: str

    license_key_id: str

    label: str

    meta: dict[str, str | int | float | bool]

    created_at: str

    modified_at: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class LicenseKeyActivationRead:
    id: str

    license_key_id: str

    label: str

    meta: dict[str, str | int | float | bool]

    created_at: str

    modified_at: str | None

    license_key: LicenseKeyRead


@dataclasses.dataclass(kw_only=True, slots=True)
class LicenseKeyCustomer:
    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: CustomerType

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class LicenseKeyRead:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    organization_id: str

    customer_id: str

    customer: LicenseKeyCustomer

    benefit_id: str
    """The benefit ID."""

    key: str

    display_key: str

    status: LicenseKeyStatus

    limit_activations: int | None

    usage: int

    limit_usage: int | None

    validations: int

    last_validated_at: str | None

    expires_at: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class LicenseKeyWithActivations:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    organization_id: str

    customer_id: str

    customer: LicenseKeyCustomer

    benefit_id: str
    """The benefit ID."""

    key: str

    display_key: str

    status: LicenseKeyStatus

    limit_activations: int | None

    usage: int

    limit_usage: int | None

    validations: int

    last_validated_at: str | None

    expires_at: str | None

    activations: list[LicenseKeyActivationBase]


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceBenefit:
    items: list[Benefit]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceBenefitGrant:
    items: list[BenefitGrant]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCheckout:
    items: list[Checkout]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCheckoutLink:
    items: list[CheckoutLink]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomField:
    items: list[CustomField]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomer:
    items: list[Customer]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerBenefitGrant:
    items: list[CustomerBenefitGrant]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerCustomerMeter:
    items: list[CustomerCustomerMeter]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerMeter:
    items: list[CustomerMeter]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerOrder:
    items: list[CustomerOrder]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerPaymentMethod:
    items: list[CustomerPaymentMethod]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerPortalMember:
    items: list[CustomerPortalMember]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerSubscription:
    items: list[CustomerSubscription]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceCustomerWallet:
    items: list[CustomerWallet]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceDiscount:
    items: list[Discount]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceDispute:
    items: list[Dispute]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceDownloadableRead:
    items: list[DownloadableRead]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceEvent:
    items: list[Event]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceEventName:
    items: list[EventName]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceEventTypeWithStats:
    items: list[EventTypeWithStats]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceFileRead:
    items: list[FileRead]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceLicenseKeyRead:
    items: list[LicenseKeyRead]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceMember:
    items: list[Member]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceMeter:
    items: list[Meter]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceOrder:
    items: list[Order]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceOrganization:
    items: list[Organization]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourcePayment:
    items: list[Payment]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourcePaymentMethod:
    items: list[PaymentMethod]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceProduct:
    items: list[Product]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceRefund:
    items: list[Refund]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceSubscription:
    items: list[Subscription]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceWebhookDelivery:
    items: list[WebhookDelivery]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceWebhookEndpoint:
    items: list[WebhookEndpoint]

    pagination: Pagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ListResourceWithCursorPaginationEvent:
    items: list[Event]

    pagination: CursorPagination


@dataclasses.dataclass(kw_only=True, slots=True)
class ManualRetryLimitExceeded:
    error: typing.Literal["ManualRetryLimitExceeded"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Member:
    """A member of a customer."""

    id: str
    """The ID of the member."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    customer_id: str
    """The ID of the customer this member belongs to."""

    email: str
    """The email address of the member."""

    name: str | None
    """The name of the member."""

    external_id: str | None
    """The ID of the member in your system. This must be unique within the customer. """

    role: MemberRole


MetadataOutputType: typing.TypeAlias = dict[str, str | int | float | bool]


@dataclasses.dataclass(kw_only=True, slots=True)
class Meter:
    metadata: MetadataOutputType

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """The name of the meter. Will be shown on customer's invoices and usage."""

    unit: MeterUnit

    custom_label: str | None = None
    """The label for the custom unit."""

    custom_multiplier: int | None = None
    """The multiplier to convert from base unit to display scale."""

    filter: Filter

    aggregation: CountAggregation | PropertyAggregation | UniqueAggregation
    """The aggregation to apply on the filtered events to calculate the meter."""

    organization_id: str
    """The ID of the organization owning the meter."""

    archived_at: str | None = None
    """Whether the meter is archived and the time it was archived."""


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterCreditEvent:
    """An event created by Polar when credits are added to a customer meter."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["meter.credited"]
    """The name of the event."""

    metadata: MeterCreditedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterCreditedMetadata:
    meter_id: str

    units: int

    rollover: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterQuantities:
    quantities: list[MeterQuantity]

    total: float
    """The total quantity for the period."""


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterQuantity:
    timestamp: str
    """The timestamp for the current period."""

    quantity: float
    """The quantity for the current period."""


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterResetEvent:
    """An event created by Polar when a customer meter is reset."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["meter.reset"]
    """The name of the event."""

    metadata: MeterResetMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class MeterResetMetadata:
    meter_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Metric:
    """Information about a metric."""

    slug: str
    """Unique identifier for the metric."""

    display_name: str
    """Human-readable name for the metric."""

    type: MetricType


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricDashboardSchema:
    """A user-defined metrics dashboard."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """Display name for the dashboard."""

    metrics: list[str]
    """List of metric slugs displayed in this dashboard."""

    organization_id: str
    """The ID of the organization owning this dashboard."""


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricPeriod:
    timestamp: str
    """Timestamp of this period data."""

    active_subscriptions: int | float | None | None = None

    committed_subscriptions: int | float | None | None = None

    monthly_recurring_revenue: int | float | None | None = None

    trial_monthly_recurring_revenue: int | float | None | None = None

    committed_monthly_recurring_revenue: int | float | None | None = None

    trial_committed_monthly_recurring_revenue: int | float | None | None = None

    average_revenue_per_user: int | float | None | None = None

    checkouts: int | float | None | None = None

    succeeded_checkouts: int | float | None | None = None

    churned_subscriptions: int | float | None | None = None

    churn_rate: int | float | None | None = None

    seats_total: int | float | None | None = None

    seats_claimed: int | float | None | None = None

    seats_pending: int | float | None | None = None

    seat_customers: int | float | None | None = None

    new_seat_customers: int | float | None | None = None

    churned_seat_customers: int | float | None | None = None

    orders: int | float | None | None = None

    revenue: int | float | None | None = None

    net_revenue: int | float | None | None = None

    cumulative_revenue: int | float | None | None = None

    net_cumulative_revenue: int | float | None | None = None

    costs: int | float | None | None = None

    cumulative_costs: int | float | None | None = None

    average_order_value: int | float | None | None = None

    net_average_order_value: int | float | None | None = None

    cost_per_user: int | float | None | None = None

    active_user_by_event: int | float | None | None = None

    one_time_products: int | float | None | None = None

    one_time_products_revenue: int | float | None | None = None

    one_time_products_net_revenue: int | float | None | None = None

    new_subscriptions: int | float | None | None = None

    new_subscriptions_revenue: int | float | None | None = None

    new_subscriptions_net_revenue: int | float | None | None = None

    renewed_subscriptions: int | float | None | None = None

    renewed_subscriptions_revenue: int | float | None | None = None

    renewed_subscriptions_net_revenue: int | float | None | None = None

    canceled_subscriptions: int | float | None | None = None

    canceled_subscriptions_customer_service: int | float | None | None = None

    canceled_subscriptions_low_quality: int | float | None | None = None

    canceled_subscriptions_missing_features: int | float | None | None = None

    canceled_subscriptions_switched_service: int | float | None | None = None

    canceled_subscriptions_too_complex: int | float | None | None = None

    canceled_subscriptions_too_expensive: int | float | None | None = None

    canceled_subscriptions_unused: int | float | None | None = None

    canceled_subscriptions_other: int | float | None | None = None

    annual_recurring_revenue: int | float | None | None = None

    committed_annual_recurring_revenue: int | float | None | None = None

    checkouts_conversion: int | float | None | None = None

    ltv: int | float | None | None = None

    gross_margin: int | float | None | None = None

    gross_margin_percentage: int | float | None | None = None

    cashflow: int | float | None | None = None

    average_seats_per_customer: int | float | None | None = None

    seat_utilization_rate: int | float | None | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class Metrics:
    active_subscriptions: Metric | None = None

    committed_subscriptions: Metric | None = None

    monthly_recurring_revenue: Metric | None = None

    trial_monthly_recurring_revenue: Metric | None = None

    committed_monthly_recurring_revenue: Metric | None = None

    trial_committed_monthly_recurring_revenue: Metric | None = None

    average_revenue_per_user: Metric | None = None

    checkouts: Metric | None = None

    succeeded_checkouts: Metric | None = None

    churned_subscriptions: Metric | None = None

    churn_rate: Metric | None = None

    seats_total: Metric | None = None

    seats_claimed: Metric | None = None

    seats_pending: Metric | None = None

    seat_customers: Metric | None = None

    new_seat_customers: Metric | None = None

    churned_seat_customers: Metric | None = None

    orders: Metric | None = None

    revenue: Metric | None = None

    net_revenue: Metric | None = None

    cumulative_revenue: Metric | None = None

    net_cumulative_revenue: Metric | None = None

    costs: Metric | None = None

    cumulative_costs: Metric | None = None

    average_order_value: Metric | None = None

    net_average_order_value: Metric | None = None

    cost_per_user: Metric | None = None

    active_user_by_event: Metric | None = None

    one_time_products: Metric | None = None

    one_time_products_revenue: Metric | None = None

    one_time_products_net_revenue: Metric | None = None

    new_subscriptions: Metric | None = None

    new_subscriptions_revenue: Metric | None = None

    new_subscriptions_net_revenue: Metric | None = None

    renewed_subscriptions: Metric | None = None

    renewed_subscriptions_revenue: Metric | None = None

    renewed_subscriptions_net_revenue: Metric | None = None

    canceled_subscriptions: Metric | None = None

    canceled_subscriptions_customer_service: Metric | None = None

    canceled_subscriptions_low_quality: Metric | None = None

    canceled_subscriptions_missing_features: Metric | None = None

    canceled_subscriptions_switched_service: Metric | None = None

    canceled_subscriptions_too_complex: Metric | None = None

    canceled_subscriptions_too_expensive: Metric | None = None

    canceled_subscriptions_unused: Metric | None = None

    canceled_subscriptions_other: Metric | None = None

    annual_recurring_revenue: Metric | None = None

    committed_annual_recurring_revenue: Metric | None = None

    checkouts_conversion: Metric | None = None

    ltv: Metric | None = None

    gross_margin: Metric | None = None

    gross_margin_percentage: Metric | None = None

    cashflow: Metric | None = None

    average_seats_per_customer: Metric | None = None

    seat_utilization_rate: Metric | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricsIntervalLimit:
    """Date interval limit to get metrics for a given interval."""

    min_days: int
    """Minimum number of days for this interval."""

    max_days: int
    """Maximum number of days for this interval."""


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricsIntervalsLimits:
    """Date interval limits to get metrics for each interval."""

    hour: MetricsIntervalLimit

    day: MetricsIntervalLimit

    week: MetricsIntervalLimit

    month: MetricsIntervalLimit

    year: MetricsIntervalLimit


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricsLimits:
    """Date limits to get metrics."""

    min_date: str
    """Minimum date to get metrics."""

    intervals: MetricsIntervalsLimits


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricsResponse:
    """Metrics response schema."""

    periods: list[MetricPeriod]
    """List of data for each timestamp."""

    totals: MetricsTotals

    metrics: Metrics


@dataclasses.dataclass(kw_only=True, slots=True)
class MetricsTotals:
    active_subscriptions: int | float | None | None = None

    committed_subscriptions: int | float | None | None = None

    monthly_recurring_revenue: int | float | None | None = None

    trial_monthly_recurring_revenue: int | float | None | None = None

    committed_monthly_recurring_revenue: int | float | None | None = None

    trial_committed_monthly_recurring_revenue: int | float | None | None = None

    average_revenue_per_user: int | float | None | None = None

    checkouts: int | float | None | None = None

    succeeded_checkouts: int | float | None | None = None

    churned_subscriptions: int | float | None | None = None

    churn_rate: int | float | None | None = None

    seats_total: int | float | None | None = None

    seats_claimed: int | float | None | None = None

    seats_pending: int | float | None | None = None

    seat_customers: int | float | None | None = None

    new_seat_customers: int | float | None | None = None

    churned_seat_customers: int | float | None | None = None

    orders: int | float | None | None = None

    revenue: int | float | None | None = None

    net_revenue: int | float | None | None = None

    cumulative_revenue: int | float | None | None = None

    net_cumulative_revenue: int | float | None | None = None

    costs: int | float | None | None = None

    cumulative_costs: int | float | None | None = None

    average_order_value: int | float | None | None = None

    net_average_order_value: int | float | None | None = None

    cost_per_user: int | float | None | None = None

    active_user_by_event: int | float | None | None = None

    one_time_products: int | float | None | None = None

    one_time_products_revenue: int | float | None | None = None

    one_time_products_net_revenue: int | float | None | None = None

    new_subscriptions: int | float | None | None = None

    new_subscriptions_revenue: int | float | None | None = None

    new_subscriptions_net_revenue: int | float | None | None = None

    renewed_subscriptions: int | float | None | None = None

    renewed_subscriptions_revenue: int | float | None | None = None

    renewed_subscriptions_net_revenue: int | float | None | None = None

    canceled_subscriptions: int | float | None | None = None

    canceled_subscriptions_customer_service: int | float | None | None = None

    canceled_subscriptions_low_quality: int | float | None | None = None

    canceled_subscriptions_missing_features: int | float | None | None = None

    canceled_subscriptions_switched_service: int | float | None | None = None

    canceled_subscriptions_too_complex: int | float | None | None = None

    canceled_subscriptions_too_expensive: int | float | None | None = None

    canceled_subscriptions_unused: int | float | None | None = None

    canceled_subscriptions_other: int | float | None | None = None

    annual_recurring_revenue: int | float | None | None = None

    committed_annual_recurring_revenue: int | float | None | None = None

    checkouts_conversion: int | float | None | None = None

    ltv: int | float | None | None = None

    gross_margin: int | float | None | None = None

    gross_margin_percentage: int | float | None | None = None

    cashflow: int | float | None | None = None

    average_seats_per_customer: int | float | None | None = None

    seat_utilization_rate: int | float | None | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class MissingInvoiceBillingDetails:
    error: typing.Literal["MissingInvoiceBillingDetails"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class NotOpenCheckout:
    error: typing.Literal["NotOpenCheckout"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class NotPermitted:
    error: typing.Literal["NotPermitted"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OAuth2ClientPublic:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    client_id: str

    client_name: str | None

    client_uri: str | None

    logo_uri: str | None

    tos_uri: str | None

    policy_uri: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class OffSessionChargesNotEnabled:
    error: typing.Literal["OffSessionChargesNotEnabled"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Order:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    status: OrderStatus

    paid: bool
    """Whether the order has been paid for."""

    subtotal_amount: int
    """Amount in cents, before discounts and taxes."""

    discount_amount: int
    """Discount amount in cents."""

    net_amount: int
    """Amount in cents, after discounts but before taxes."""

    tax_amount: int
    """Sales tax amount in cents."""

    total_amount: int
    """Amount in cents, after discounts and taxes."""

    applied_balance_amount: int
    """Customer's balance amount applied to this invoice. Can increase the total amount paid, if the customer has a negative balance,  or decrease it, if the customer has a positive balance.Amount in cents."""

    due_amount: int
    """Amount in cents that is due for this order."""

    refunded_amount: int
    """Amount refunded in cents."""

    refunded_tax_amount: int
    """Sales tax refunded in cents."""

    currency: str

    billing_reason: OrderBillingReason

    billing_name: str | None
    """The name of the customer that should appear on the invoice. """

    billing_address: Address | None

    invoice_number: str | None
    """The invoice number associated with this order. `null` while the order is in `draft` status; assigned at finalize."""

    is_invoice_generated: bool
    """Whether an invoice has been generated for this order."""

    receipt_number: str | None
    """The receipt number for this order. Set once the order is paid for organizations with receipts enabled. When set, a downloadable receipt PDF can be obtained via the receipt endpoint."""

    seats: int | None = None
    """Number of seats purchased (for seat-based one-time orders)."""

    customer_id: str

    product_id: str | None

    discount_id: str | None

    subscription_id: str | None

    checkout_id: str | None

    next_payment_attempt_at: str | None = None
    """When the next automatic payment retry is scheduled. `null` if the order is not in dunning or all retries have been exhausted."""

    metadata: MetadataOutputType

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    platform_fee_amount: int
    """Platform fee amount in cents."""

    platform_fee_currency: str | None
    """Currency of the platform fee."""

    customer: OrderCustomer

    product: OrderProduct | None

    discount: (
        DiscountFixedOnceForeverDurationBase
        | DiscountFixedRepeatDurationBase
        | DiscountPercentageOnceForeverDurationBase
        | DiscountPercentageRepeatDurationBase
        | None
    )

    subscription: OrderSubscription | None

    items: list[OrderItemSchema]
    """Line items composing the order."""

    description: str
    """A summary description of the order."""

    refundable_amount: int
    """Amount in cents that can still be refunded (net, before taxes). Accounts for any applied customer balance and previous refunds."""

    refundable_tax_amount: int
    """Sales tax in cents that would be refunded if the full refundable amount is refunded."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderCustomer:
    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: CustomerType

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderInvoice:
    """Order's invoice data."""

    url: str
    """The URL to the invoice."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderItemSchema:
    """An order line item."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    label: str
    """Description of the line item charge."""

    amount: int
    """Amount in cents, before discounts and taxes."""

    tax_amount: int
    """Sales tax amount in cents."""

    proration: bool
    """Whether this charge is due to a proration."""

    product_price_id: str | None
    """Associated price ID, if any."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderNotDraft:
    error: typing.Literal["OrderNotDraft"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderNotEligibleForInvoice:
    error: typing.Literal["OrderNotEligibleForInvoice"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderNotEligibleForRetry:
    error: typing.Literal["OrderNotEligibleForRetry"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderPaidEvent:
    """An event created by Polar when an order is paid."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["order.paid"]
    """The name of the event."""

    metadata: OrderPaidMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderPaidMetadata:
    order_id: str

    product_id: str | None = None

    billing_type: str | None = None

    amount: int

    currency: str | None = None

    net_amount: int | None = None

    tax_amount: int | None = None

    applied_balance_amount: int | None = None

    discount_amount: int | None = None

    discount_id: str | None = None

    platform_fee: int | None = None

    subscription_id: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderProduct:
    metadata: MetadataOutputType

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderReceipt:
    """Order's receipt data."""

    url: str
    """The URL to the receipt PDF."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderRefundedEvent:
    """An event created by Polar when an order is refunded."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["order.refunded"]
    """The name of the event."""

    metadata: OrderRefundedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderRefundedMetadata:
    order_id: str

    refunded_amount: int

    currency: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderSubscription:
    metadata: MetadataOutputType

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    amount: int
    """The amount of the subscription."""

    currency: str
    """The currency of the subscription."""

    recurring_interval: RecurringInterval

    recurring_interval_count: int
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on."""

    status: SubscriptionStatus

    current_period_start: str
    """The start timestamp of the current billing period."""

    current_period_end: str
    """The end timestamp of the current billing period."""

    current_meter_period_start: str | None
    """The start timestamp of the current meter period, if the product has a meter cycle set. Metered credits are granted and overage is settled on this cadence."""

    current_meter_period_end: str | None
    """The end timestamp of the current meter period, if the product has a meter cycle set. This is when credits next renew."""

    trial_start: str | None
    """The start timestamp of the trial period, if any."""

    trial_end: str | None
    """The end timestamp of the trial period, if any."""

    cancel_at_period_end: bool
    """Whether the subscription will be canceled at the end of the current period."""

    canceled_at: str | None
    """The timestamp when the subscription was canceled. The subscription might still be active if `cancel_at_period_end` is `true`."""

    started_at: str | None
    """The timestamp when the subscription started."""

    ends_at: str | None
    """The timestamp when the subscription will end."""

    ended_at: str | None
    """The timestamp when the subscription ended."""

    past_due_at: str | None = None
    """The timestamp when the subscription entered `past_due` status."""

    pause_at_period_end: bool
    """Whether the subscription will be paused at the end of the current period."""

    paused_at: str | None
    """The timestamp when the subscription was paused."""

    resumes_at: str | None
    """The timestamp when a paused subscription is scheduled to automatically resume, if set."""

    customer_id: str
    """The ID of the subscribed customer."""

    product_id: str
    """The ID of the subscribed product."""

    discount_id: str | None
    """The ID of the applied discount, if any."""

    checkout_id: str | None

    seats: int | None = None
    """The number of seats for seat-based subscriptions. None for non-seat subscriptions."""

    customer_cancellation_reason: CustomerCancellationReason | None

    customer_cancellation_comment: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderVoidedEvent:
    """An event created by Polar when an order is voided."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["order.voided"]
    """The name of the event."""

    metadata: OrderVoidedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class OrderVoidedMetadata:
    order_id: str

    amount: int

    currency: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Organization:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    name: str
    """Organization name shown in checkout, customer portal, emails etc."""

    slug: str
    """Unique organization slug in checkout, customer portal and credit card statements."""

    avatar_url: str | None
    """Avatar URL shown in checkout, customer portal, emails etc."""

    proration_behavior: SubscriptionProrationBehavior

    allow_customer_updates: bool
    """Whether customers can update their subscriptions from the customer portal."""

    email: str | None
    """Public support email."""

    website: str | None
    """Official website of the organization."""

    socials: list[OrganizationSocialLink]
    """Links to social profiles."""

    status: OrganizationStatus

    details_submitted_at: str | None
    """When the business details were submitted for review."""

    sso_enforced: bool
    """Whether members must access this organization through its SSO connection."""

    default_presentment_currency: str
    """Default presentment currency. Used as fallback in checkout and customer portal, if the customer's local currency is not available."""

    default_tax_behavior: TaxBehaviorOption

    feature_settings: OrganizationFeatureSettings | None
    """Organization feature settings"""

    subscription_settings: OrganizationSubscriptionSettings

    customer_email_settings: OrganizationCustomerEmailSettings

    customer_portal_settings: OrganizationCustomerPortalSettings

    country: CountryAlpha2 | None = None
    """Two-letter country code (ISO 3166-1 alpha-2)."""

    account_id: str | None
    """ID of the transactions account."""

    payout_account_id: str | None
    """ID of the payout account."""

    capabilities: OrganizationCapabilities


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationAvatarFileRead:
    """File to be used as an organization avatar."""

    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    version: str | None

    service: typing.Literal["organization_avatar"]

    is_uploaded: bool

    created_at: str

    size_readable: str

    public_url: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationCapabilities:
    checkout_payments: bool
    """Whether the organization can accept new checkout payments."""

    subscription_renewals: bool
    """Whether the organization can process subscription renewals."""

    payouts: bool
    """Whether the organization can withdraw its balance."""

    refunds: bool
    """Whether the organization can issue refunds."""

    api_access: bool
    """Whether the organization can access the API."""

    dashboard_access: bool
    """Whether the organization can access the dashboard."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationCustomerEmailSettings:
    order_confirmation: bool

    subscription_cancellation: bool

    subscription_confirmation: bool

    subscription_cycled: bool

    subscription_cycled_after_trial: bool

    subscription_past_due: bool

    subscription_paused: bool

    subscription_resumed: bool

    subscription_renewal_reminder: bool

    subscription_revoked: bool

    subscription_trial_conversion_reminder: bool

    subscription_uncanceled: bool

    subscription_updated: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationCustomerPortalSettings:
    usage: CustomerPortalUsageSettings

    subscription: CustomerPortalSubscriptionSettings

    customer: CustomerPortalCustomerSettings | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationFeatureSettings:
    issue_funding_enabled: bool = False
    """If this organization has issue funding enabled"""

    seat_based_pricing_enabled: bool = False
    """If this organization has seat-based pricing enabled"""

    wallets_enabled: bool = False
    """If this organization has Wallets enabled"""

    member_model_enabled: bool = False
    """If this organization has the Member model enabled"""

    checkout_localization_enabled: bool = False
    """If this organization has checkout localization enabled"""

    overview_metrics: list[str] | None = None
    """Ordered list of metric slugs shown on the dashboard overview."""

    reset_proration_behavior_enabled: bool = False
    """If this organization has access to reset proration behavior."""

    off_session_charges_enabled: bool = False
    """If this organization can create and finalize draft orders via the API (off-session charges against a saved payment method)."""

    slack_benefit_enabled: bool = False
    """Enables the slack shared channel benefit"""

    preview_access_enabled: bool = False
    """If this organization has preview access to new features enabled"""

    disputes_enabled: bool = False
    """If this organization has the disputes dashboard enabled"""

    sso_enabled: bool = False
    """If this organization has single sign-on configuration enabled"""

    compass_enabled: bool = False
    """If this organization has the split product navigation (Billing / Compass / Customers) enabled in the dashboard"""

    merchant_migration_enabled: bool = False
    """If this organization can migrate its billing from another provider (e.g. Stripe) to Polar."""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationNotReadyForPayments:
    error: typing.Literal["OrganizationNotReadyForPayments"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationSocialLink:
    platform: OrganizationSocialPlatforms

    url: str
    """The URL to the organization profile"""


@dataclasses.dataclass(kw_only=True, slots=True)
class OrganizationSubscriptionSettings:
    allow_multiple_subscriptions: bool

    proration_behavior: PublicSubscriptionProrationBehavior

    benefit_revocation_grace_period: int

    prevent_trial_abuse: bool

    allow_customer_updates: bool


@dataclasses.dataclass(kw_only=True, slots=True)
class Pagination:
    total_count: int

    max_page: int


@dataclasses.dataclass(kw_only=True, slots=True)
class PauseResumeNotAllowed:
    error: typing.Literal["PauseResumeNotAllowed"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentActionRequired:
    error: typing.Literal["PaymentActionRequired"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentAlreadyInProgress:
    error: typing.Literal["PaymentAlreadyInProgress"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentError:
    error: typing.Literal["PaymentError"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentFailed:
    error: typing.Literal["PaymentFailed"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentMethodCard:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    processor: PaymentProcessor

    customer_id: str

    type: typing.Literal["card"]

    method_metadata: PaymentMethodCardMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentMethodCardMetadata:
    brand: str

    last4: str

    exp_month: int

    exp_year: int

    wallet: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentMethodGeneric:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    processor: PaymentProcessor

    customer_id: str

    type: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentMethodInUseByActiveSubscription:
    error: typing.Literal["PaymentMethodInUseByActiveSubscription"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentMethodSetupFailed:
    error: typing.Literal["PaymentMethodSetupFailed"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PaymentNotReady:
    error: typing.Literal["PaymentNotReady"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class PendingSubscriptionUpdate:
    """Pending update to be applied to a subscription at the beginning of the next period."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    applies_at: str
    """The date and time when the subscription update will be applied."""

    product_id: str | None
    """ID of the new product to apply to the subscription. If `null`, the product won't be changed."""

    seats: int | None
    """Number of seats to apply to the subscription. If `null`, the number of seats won't be changed."""


@dataclasses.dataclass(kw_only=True, slots=True)
class PortalAuthenticatedUser:
    """Information about the authenticated portal user."""

    type: str
    """Type of authenticated user: 'customer' or 'member'"""

    name: str | None
    """User's name, if available."""

    email: str
    """User's email address."""

    customer_id: str
    """Associated customer ID."""

    member_id: str | None = None
    """Member ID. Only set for members."""

    role: str | None = None
    """Member role (owner, billing_manager, member). Only set for members."""


@dataclasses.dataclass(kw_only=True, slots=True)
class Product:
    """A product."""

    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    trial_interval: TrialInterval | None
    """The interval unit for the trial period."""

    trial_interval_count: int | None
    """The number of interval units for the trial period."""

    name: str
    """The name of the product."""

    description: str | None
    """The description of the product."""

    visibility: ProductVisibility

    recurring_interval: RecurringInterval | None
    """The recurring interval of the product. If `None`, the product is a one-time purchase."""

    recurring_interval_count: int | None
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. None for one-time products."""

    meter_interval: RecurringInterval | None
    """The meter cycle of the product, independent of the billing interval. If `None`, metered concerns follow the billing interval."""

    meter_interval_count: int | None
    """Number of meter interval units. None when no meter cycle is set."""

    is_recurring: bool
    """Whether the product is a subscription."""

    is_archived: bool
    """Whether the product is archived and no longer available."""

    organization_id: str
    """The ID of the organization owning the product."""

    metadata: MetadataOutputType

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of prices for this product."""

    benefits: list[Benefit]
    """List of benefits granted by the product."""

    medias: list[ProductMediaFileRead]
    """List of medias associated to the product."""

    attached_custom_fields: list[AttachedCustomField]
    """List of custom fields attached to the product."""


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductMediaFileRead:
    """File to be used as a product media file."""

    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    version: str | None

    service: typing.Literal["product_media"]

    is_uploaded: bool

    created_at: str

    size_readable: str

    public_url: str


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceCustom:
    """A pay-what-you-want price for a product."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["custom"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    minimum_amount: int
    """The minimum amount the customer can pay. If 0, the price is 'free or pay what you want'."""

    maximum_amount: int | None
    """The maximum amount the customer can pay."""

    preset_amount: int | None
    """The initial amount shown to the customer."""


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceFixed:
    """A fixed price for a product."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["fixed"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    price_amount: int
    """The price in cents."""


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceMeter:
    """A meter associated to a metered price."""

    id: str
    """The ID of the object."""

    name: str
    """The name of the meter."""

    unit: MeterUnit

    custom_label: str | None
    """The label for the custom unit."""

    custom_multiplier: int | None
    """The multiplier to convert from base unit to display scale."""


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceMeteredUnit:
    """A metered, usage-based, price for a product, with a fixed unit price."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["metered_unit"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    unit_amount: str
    """The price per unit in cents."""

    cap_amount: int | None
    """The maximum amount in cents that can be charged, regardless of the number of units consumed."""

    meter_id: str
    """The ID of the meter associated to the price."""

    meter: ProductPriceMeter


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceSeatBased:
    """A seat-based price for a product."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the price."""

    source: ProductPriceSource

    amount_type: typing.Literal["seat_based"]

    price_currency: str
    """The currency in which the customer will be charged."""

    tax_behavior: TaxBehaviorOption | None
    """The tax behavior of the price. If null, it defaults to the organization's default tax behavior."""

    is_archived: bool
    """Whether the price is archived and no longer available."""

    product_id: str
    """The ID of the product owning the price."""

    seat_tiers: ProductPriceSeatTiersOutput


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceSeatTier:
    """A pricing tier for seat-based pricing."""

    min_seats: int
    """Minimum number of seats (inclusive)"""

    max_seats: int | None = None
    """Maximum number of seats (inclusive). None for unlimited."""

    price_per_seat: int
    """Price per seat in cents for this tier"""


@dataclasses.dataclass(kw_only=True, slots=True)
class ProductPriceSeatTiersOutput:
    """List of pricing tiers for seat-based pricing.

    The minimum and maximum seat limits are derived from the tiers:
    - minimum_seats = first tier's min_seats
    - maximum_seats = last tier's max_seats (None for unlimited)"""

    seat_tier_type: SeatTierType | None = None

    tiers: list[ProductPriceSeatTier]
    """List of pricing tiers"""

    minimum_seats: int
    """Minimum number of seats required for purchase, derived from first tier."""

    maximum_seats: int | None
    """Maximum number of seats allowed for purchase, derived from last tier. None for unlimited."""


@dataclasses.dataclass(kw_only=True, slots=True)
class PropertyAggregation:
    func: Func

    property: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Refund:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    metadata: MetadataOutputType

    status: RefundStatus

    reason: RefundReason

    amount: int

    tax_amount: int

    currency: str

    organization_id: str

    order_id: str

    subscription_id: str | None

    customer_id: str

    revoke_benefits: bool

    dispute: RefundDispute | None


@dataclasses.dataclass(kw_only=True, slots=True)
class RefundDispute:
    """Dispute associated with a refund,
    in case we prevented a dispute by issuing a refund."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    status: DisputeStatus

    resolved: bool
    """Whether the dispute has been resolved (won or lost)."""

    closed: bool
    """Whether the dispute is closed (prevented, won, or lost)."""

    amount: int
    """Amount in cents disputed."""

    tax_amount: int
    """Tax amount in cents disputed."""

    currency: str
    """Currency code of the dispute."""

    reason: str | None
    """The reason for the dispute as reported by the card network (e.g. `fraudulent`, `product_not_received`). `None` until the processor reports it."""

    evidence_due_by: str | None
    """Deadline to submit evidence in response to the dispute. `None` when no response is required."""

    past_due: bool
    """Whether the evidence submission deadline has passed."""

    order_id: str
    """The ID of the order associated with the dispute."""

    payment_id: str
    """The ID of the payment associated with the dispute."""


@dataclasses.dataclass(kw_only=True, slots=True)
class RefundedAlready:
    error: typing.Literal["RefundedAlready"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class ResourceNotFound:
    error: typing.Literal["ResourceNotFound"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class RevokeTokenResponse: ...


@dataclasses.dataclass(kw_only=True, slots=True)
class S3DownloadURL:
    url: str

    headers: dict[str, str] = dataclasses.field(default_factory=dict)

    expires_at: str


@dataclasses.dataclass(kw_only=True, slots=True)
class S3FileUploadMultipart:
    id: str

    path: str

    parts: list[S3FileUploadPart]


@dataclasses.dataclass(kw_only=True, slots=True)
class S3FileUploadPart:
    number: int

    chunk_start: int

    chunk_end: int

    checksum_sha256_base64: str | None = None

    url: str

    expires_at: str

    headers: dict[str, str] = dataclasses.field(default_factory=dict)


@dataclasses.dataclass(kw_only=True, slots=True)
class SSOEnforcementRequiresConnection:
    error: typing.Literal["SSOEnforcementRequiresConnection"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SeatClaimInfo:
    """Read-only information about a seat claim invitation.
    Safe for email scanners - no side effects when fetched."""

    product_name: str
    """Name of the product"""

    product_id: str
    """ID of the product"""

    organization_name: str
    """Name of the organization"""

    organization_slug: str
    """Slug of the organization"""

    customer_email: str
    """Email of the customer assigned to this seat"""

    can_claim: bool
    """Whether the seat can be claimed"""


@dataclasses.dataclass(kw_only=True, slots=True)
class SeatsList:
    seats: list[CustomerSeat]
    """List of seats"""

    available_seats: int
    """Number of available seats"""

    total_seats: int
    """Total number of seats for the subscription"""


@dataclasses.dataclass(kw_only=True, slots=True)
class Subscription:
    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    amount: int
    """The amount of the subscription."""

    currency: str
    """The currency of the subscription."""

    recurring_interval: RecurringInterval

    recurring_interval_count: int
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on."""

    status: SubscriptionStatus

    current_period_start: str
    """The start timestamp of the current billing period."""

    current_period_end: str
    """The end timestamp of the current billing period."""

    current_meter_period_start: str | None
    """The start timestamp of the current meter period, if the product has a meter cycle set. Metered credits are granted and overage is settled on this cadence."""

    current_meter_period_end: str | None
    """The end timestamp of the current meter period, if the product has a meter cycle set. This is when credits next renew."""

    trial_start: str | None
    """The start timestamp of the trial period, if any."""

    trial_end: str | None
    """The end timestamp of the trial period, if any."""

    cancel_at_period_end: bool
    """Whether the subscription will be canceled at the end of the current period."""

    canceled_at: str | None
    """The timestamp when the subscription was canceled. The subscription might still be active if `cancel_at_period_end` is `true`."""

    started_at: str | None
    """The timestamp when the subscription started."""

    ends_at: str | None
    """The timestamp when the subscription will end."""

    ended_at: str | None
    """The timestamp when the subscription ended."""

    past_due_at: str | None = None
    """The timestamp when the subscription entered `past_due` status."""

    pause_at_period_end: bool
    """Whether the subscription will be paused at the end of the current period."""

    paused_at: str | None
    """The timestamp when the subscription was paused."""

    resumes_at: str | None
    """The timestamp when a paused subscription is scheduled to automatically resume, if set."""

    customer_id: str
    """The ID of the subscribed customer."""

    product_id: str
    """The ID of the subscribed product."""

    discount_id: str | None
    """The ID of the applied discount, if any."""

    checkout_id: str | None

    seats: int | None = None
    """The number of seats for seat-based subscriptions. None for non-seat subscriptions."""

    customer_cancellation_reason: CustomerCancellationReason | None

    customer_cancellation_comment: str | None

    metadata: MetadataOutputType

    custom_field_data: dict[str, str | int | bool | str | None] | None = None
    """Key-value object storing custom field values."""

    customer: SubscriptionCustomer

    product: Product

    discount: (
        DiscountFixedOnceForeverDurationBase
        | DiscountFixedRepeatDurationBase
        | DiscountPercentageOnceForeverDurationBase
        | DiscountPercentageRepeatDurationBase
        | None
    )

    prices: list[LegacyRecurringProductPrice | ProductPrice]
    """List of enabled prices for the subscription."""

    meters: list[SubscriptionMeter]
    """List of meters associated with the subscription."""

    pending_update: PendingSubscriptionUpdate | None
    """Pending subscription update that will be applied at the beginning of the next period. If `null`, there is no pending update."""


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionBillingPeriodUpdatedEvent:
    """An event created by Polar when a subscription billing period is updated."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.billing_period_updated"]
    """The name of the event."""

    metadata: SubscriptionBillingPeriodUpdatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionBillingPeriodUpdatedMetadata:
    subscription_id: str

    old_period_end: str

    new_period_end: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCanceledEvent:
    """An event created by Polar when a subscription is canceled."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.canceled"]
    """The name of the event."""

    metadata: SubscriptionCanceledMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCanceledMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int

    currency: str

    recurring_interval: str

    recurring_interval_count: int

    customer_cancellation_reason: str | None = None

    customer_cancellation_comment: str | None = None

    canceled_at: str

    ends_at: str | None = None

    cancel_at_period_end: bool | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCreatedEvent:
    """An event created by Polar when a subscription is created."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.created"]
    """The name of the event."""

    metadata: SubscriptionCreatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCreatedMetadata:
    subscription_id: str

    product_id: str

    amount: int

    currency: str

    recurring_interval: str

    recurring_interval_count: int

    started_at: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCustomer:
    id: str
    """The ID of the customer."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    metadata: MetadataOutputType

    external_id: str | None = None
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    email: str | None = None
    """The email address of the customer. This must be unique within the organization."""

    email_verified: bool
    """Whether the customer email address is verified. The address is automatically verified when the customer accesses the customer portal using their email address."""

    type: CustomerType

    name: str | None
    """The name of the customer."""

    billing_name: str | None
    """The name that should appear on the customer's invoices. Falls back to the customer name when not explicitly set."""

    billing_address: Address | None

    tax_id: list[typing.Any] | None

    locale: str | None = None

    organization_id: str
    """The ID of the organization owning the customer."""

    default_payment_method_id: str | None = None
    """The ID of the customer's default payment method, if any. Use the payment methods endpoint to retrieve its details."""

    deleted_at: str | None
    """Timestamp for when the customer was soft deleted."""

    avatar_url: str | None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCycledEvent:
    """An event created by Polar when a subscription is cycled."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.cycled"]
    """The name of the event."""

    metadata: SubscriptionCycledMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionCycledMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionLocked:
    error: typing.Literal["SubscriptionLocked"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionMeter:
    """Current consumption and spending for a subscription meter."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    consumed_units: float
    """The number of consumed units so far in this billing period."""

    credited_units: int
    """The number of credited units so far in this billing period."""

    amount: int
    """The amount due in cents so far in this billing period."""

    meter_id: str
    """The ID of the meter."""

    meter: Meter


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionPastDueEvent:
    """An event created by Polar when a subscription becomes past due."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.past_due"]
    """The name of the event."""

    metadata: SubscriptionPastDueMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionPastDueMetadata:
    subscription_id: str

    product_id: str | None = None

    past_due_at: str

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionPausedEvent:
    """An event created by Polar when a subscription is paused."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.paused"]
    """The name of the event."""

    metadata: SubscriptionPausedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionPausedMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None

    paused_at: str

    resumes_at: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionProductUpdatedEvent:
    """An event created by Polar when a subscription changes the product."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.product_updated"]
    """The name of the event."""

    metadata: SubscriptionProductUpdatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionProductUpdatedMetadata:
    subscription_id: str

    old_product_id: str

    new_product_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionReactivatedEvent:
    """An event created by Polar when a past due subscription is recovered."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.reactivated"]
    """The name of the event."""

    metadata: SubscriptionReactivatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionReactivatedMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionResumedEvent:
    """An event created by Polar when a paused subscription is resumed."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.resumed"]
    """The name of the event."""

    metadata: SubscriptionResumedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionResumedMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionRevokedEvent:
    """An event created by Polar when a subscription is revoked from a customer."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.revoked"]
    """The name of the event."""

    metadata: SubscriptionRevokedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionRevokedMetadata:
    subscription_id: str

    product_id: str | None = None

    amount: int | None = None

    currency: str | None = None

    recurring_interval: str | None = None

    recurring_interval_count: int | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionSeatsUpdatedEvent:
    """An event created by Polar when a the seats on a subscription is changed."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.seats_updated"]
    """The name of the event."""

    metadata: SubscriptionSeatsUpdatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionSeatsUpdatedMetadata:
    subscription_id: str

    old_seats: int

    new_seats: int

    proration_behavior: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUncanceledEvent:
    """An event created by Polar when a subscription cancellation is reversed."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.uncanceled"]
    """The name of the event."""

    metadata: SubscriptionUncanceledMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUncanceledMetadata:
    subscription_id: str

    product_id: str

    amount: int

    currency: str

    recurring_interval: str

    recurring_interval_count: int


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUpdateClearedEvent:
    """An event created by Polar when a pending subscription update is cleared without being applied."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.update_cleared"]
    """The name of the event."""

    metadata: SubscriptionUpdateClearedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUpdateClearedMetadata:
    subscription_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUpdatedEvent:
    """An event created by Polar when a subscription is updated."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    source: typing.Literal["system"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    name: typing.Literal["subscription.updated"]
    """The name of the event."""

    metadata: SubscriptionUpdatedMetadata


@dataclasses.dataclass(kw_only=True, slots=True)
class SubscriptionUpdatedMetadata:
    product_id: str | None = None

    proration_behavior: SubscriptionProrationBehavior | None = None

    discount_id: str | None = None

    trial_end: str | None = None

    seats: int | None = None

    billing_period_end: str | None = None

    subscription_id: str


@dataclasses.dataclass(kw_only=True, slots=True)
class SupportCaseAttachmentFileRead:
    """File attached to a support case (private; fetched via presigned URL)."""

    id: str
    """The ID of the object."""

    organization_id: str

    name: str

    path: str

    mime_type: str

    size: int

    storage_version: str | None

    checksum_etag: str | None

    checksum_sha256_base64: str | None

    checksum_sha256_hex: str | None

    last_modified_at: str | None

    version: str | None

    service: typing.Literal["support_case_attachment"]

    is_uploaded: bool

    created_at: str

    size_readable: str


@dataclasses.dataclass(kw_only=True, slots=True)
class TokenResponse:
    access_token: str

    token_type: typing.Literal["Bearer"]

    expires_in: int

    refresh_token: str | None = None

    scope: str

    id_token: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class TrialAlreadyRedeemed:
    error: typing.Literal["TrialAlreadyRedeemed"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class Unauthorized:
    error: typing.Literal["Unauthorized"]

    detail: str


@dataclasses.dataclass(kw_only=True, slots=True)
class UniqueAggregation:
    func: typing.Literal["unique"] = "unique"

    property: str


@dataclasses.dataclass(kw_only=True, slots=True)
class UserEvent:
    """An event you created through the ingestion API."""

    id: str
    """The ID of the object."""

    timestamp: str
    """The timestamp of the event."""

    organization_id: str
    """The ID of the organization owning the event."""

    customer_id: str | None
    """ID of the customer in your Polar organization associated with the event."""

    customer: Customer | None
    """The customer associated with the event."""

    external_customer_id: str | None
    """ID of the customer in your system associated with the event."""

    member_id: str | None = None
    """ID of the member within the customer's organization who performed the action inside B2B."""

    external_member_id: str | None = None
    """ID of the member in your system within the customer's organization who performed the action inside B2B."""

    child_count: int = 0
    """Number of direct child events linked to this event."""

    parent_id: str | None = None
    """The ID of the parent event."""

    label: str
    """Human readable label of the event type."""

    name: str
    """The name of the event."""

    source: typing.Literal["user"]
    """The source of the event. `system` events are created by Polar. `user` events are the one you create through our ingestion API."""

    metadata: EventMetadataOutput


@dataclasses.dataclass(kw_only=True, slots=True)
class UserInfoOrganization:
    sub: str

    name: str | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class UserInfoUser:
    sub: str

    name: str | None = None

    email: str | None = None

    email_verified: bool | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class ValidatedLicenseKey:
    id: str
    """The ID of the object."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    organization_id: str

    customer_id: str

    customer: LicenseKeyCustomer

    benefit_id: str
    """The benefit ID."""

    key: str

    display_key: str

    status: LicenseKeyStatus

    limit_activations: int | None

    usage: int

    limit_usage: int | None

    validations: int

    last_validated_at: str | None

    expires_at: str | None

    activation: LicenseKeyActivationBase | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class ValidationError:
    loc: list[str | int]

    msg: str

    type: str

    input: typing.Any | None = None

    ctx: Context | None = None


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookDelivery:
    """A webhook delivery for a webhook event."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    succeeded: bool
    """Whether the delivery was successful."""

    http_code: int | None
    """The HTTP code returned by the URL. `null` if the endpoint was unreachable."""

    response: str | None
    """The response body returned by the URL, or the error message if the endpoint was unreachable."""

    webhook_event: WebhookEvent


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookEndpoint:
    """A webhook endpoint."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    url: str
    """The URL where the webhook events will be sent."""

    name: str | None = None
    """An optional name for the webhook endpoint to help organize and identify it."""

    format: WebhookFormat

    secret: str
    """The secret used to sign the webhook events."""

    organization_id: str
    """The organization ID associated with the webhook endpoint."""

    events: list[WebhookEventType]
    """The events that will trigger the webhook."""

    enabled: bool
    """Whether the webhook endpoint is enabled and will receive events."""


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookEvent:
    """A webhook event.

    An event represent something that happened in the system
    that should be sent to the webhook endpoint.

    It can be delivered multiple times until it's marked as succeeded,
    each one creating a new delivery."""

    created_at: str
    """Creation timestamp of the object."""

    modified_at: str | None
    """Last modification timestamp of the object."""

    id: str
    """The ID of the object."""

    last_http_code: int | None = None
    """Last HTTP code returned by the URL. `null` if no delviery has been attempted or if the endpoint was unreachable."""

    succeeded: bool | None = None
    """Whether this event was successfully delivered. `null` if no delivery has been attempted."""

    skipped: bool
    """Whether this event was skipped because the webhook endpoint was disabled."""

    payload: str | None
    """The payload of the webhook event."""

    type: WebhookEventType

    is_archived: bool
    """Whether this event is archived. Archived events can't be redelivered, and the payload is not accessible anymore."""


Benefit: typing.TypeAlias = (
    BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
    | BenefitDownloadables
    | BenefitLicenseKeys
    | BenefitMeterCredit
    | BenefitFeatureFlag
    | BenefitSlackSharedChannel
)

BenefitGrantWebhook: typing.TypeAlias = (
    BenefitGrantDiscordWebhook
    | BenefitGrantCustomWebhook
    | BenefitGrantGitHubRepositoryWebhook
    | BenefitGrantDownloadablesWebhook
    | BenefitGrantLicenseKeysWebhook
    | BenefitGrantMeterCreditWebhook
    | BenefitGrantFeatureFlagWebhook
    | BenefitGrantSlackSharedChannelWebhook
)

CheckoutForbiddenError: typing.TypeAlias = (
    AlreadyActiveSubscriptionError
    | NotOpenCheckout
    | PaymentNotReady
    | TrialAlreadyRedeemed
)

CustomField: typing.TypeAlias = (
    CustomFieldText
    | CustomFieldNumber
    | CustomFieldDate
    | CustomFieldCheckbox
    | CustomFieldSelect
)

Customer: typing.TypeAlias = CustomerIndividual | CustomerTeam

CustomerBenefitGrant: typing.TypeAlias = (
    CustomerBenefitGrantDiscord
    | CustomerBenefitGrantGitHubRepository
    | CustomerBenefitGrantDownloadables
    | CustomerBenefitGrantLicenseKeys
    | CustomerBenefitGrantCustom
    | CustomerBenefitGrantMeterCredit
    | CustomerBenefitGrantFeatureFlag
    | CustomerBenefitGrantSlackSharedChannel
)

CustomerPaymentMethod: typing.TypeAlias = PaymentMethodCard | PaymentMethodGeneric

CustomerPaymentMethodCreateResponse: typing.TypeAlias = (
    CustomerPaymentMethodCreateSucceededResponse
    | CustomerPaymentMethodCreateRequiresActionResponse
)

CustomerState: typing.TypeAlias = CustomerStateIndividual | CustomerStateTeam

Discount: typing.TypeAlias = (
    DiscountFixedOnceForeverDuration
    | DiscountFixedRepeatDuration
    | DiscountPercentageOnceForeverDuration
    | DiscountPercentageRepeatDuration
)

FileRead: typing.TypeAlias = (
    DownloadableFileRead
    | ProductMediaFileRead
    | OrganizationAvatarFileRead
    | SupportCaseAttachmentFileRead
)

LegacyRecurringProductPrice: typing.TypeAlias = (
    LegacyRecurringProductPriceFixed | LegacyRecurringProductPriceCustom
)

Payment: typing.TypeAlias = CardPayment | GenericPayment

PaymentMethod: typing.TypeAlias = (
    CustomerPaymentMethodCard | CustomerPaymentMethodGeneric
)

ProductPrice: typing.TypeAlias = (
    ProductPriceFixed
    | ProductPriceCustom
    | ProductPriceSeatBased
    | ProductPriceMeteredUnit
)

SystemEvent: typing.TypeAlias = (
    MeterCreditEvent
    | MeterResetEvent
    | BenefitGrantedEvent
    | BenefitCycledEvent
    | BenefitUpdatedEvent
    | BenefitRevokedEvent
    | SubscriptionCreatedEvent
    | SubscriptionUpdatedEvent
    | SubscriptionCycledEvent
    | SubscriptionCanceledEvent
    | SubscriptionRevokedEvent
    | SubscriptionPastDueEvent
    | SubscriptionReactivatedEvent
    | SubscriptionPausedEvent
    | SubscriptionResumedEvent
    | SubscriptionUncanceledEvent
    | SubscriptionProductUpdatedEvent
    | SubscriptionSeatsUpdatedEvent
    | SubscriptionBillingPeriodUpdatedEvent
    | SubscriptionUpdateClearedEvent
    | OrderPaidEvent
    | OrderRefundedEvent
    | OrderVoidedEvent
    | CheckoutCreatedEvent
    | CustomerCreatedEvent
    | CustomerUpdatedEvent
    | CustomerDeletedEvent
    | BalanceOrderEvent
    | BalanceCreditOrderEvent
    | BalanceRefundEvent
    | BalanceRefundReversalEvent
    | BalanceDisputeEvent
    | BalanceDisputeReversalEvent
)

Event: typing.TypeAlias = SystemEvent | UserEvent
