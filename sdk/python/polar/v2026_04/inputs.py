from __future__ import annotations

import typing

from polar.v2026_04.literals import (
    BenefitVisibility,
    CountryAlpha2Input,
    CustomerCancellationReason,
    CustomerType,
    DiscountDuration,
    DiscountType,
    FilterConjunction,
    FilterOperator,
    Func,
    LicenseKeyStatus,
    MemberRole,
    MeterUnit,
    OrganizationSocialPlatforms,
    PaymentProcessor,
    Permission,
    PresentmentCurrency,
    ProductVisibility,
    PublicSubscriptionProrationBehavior,
    Reason,
    RecurringInterval,
    Role,
    SeatTierType,
    SubscriptionProrationBehavior,
    SubType,
    TaxBehaviorOption,
    Timeframe,
    TokenEndpointAuthMethod,
    TrialInterval,
    WebhookEventType,
    WebhookFormat,
)


class AddressInput(typing.TypedDict):
    line1: typing.NotRequired[str | None]

    line2: typing.NotRequired[str | None]

    postal_code: typing.NotRequired[str | None]

    city: typing.NotRequired[str | None]

    state: typing.NotRequired[str | None]

    country: CountryAlpha2Input


class AttachedCustomFieldCreate(typing.TypedDict):
    """Schema to attach a custom field to a resource."""

    custom_field_id: str
    """ID of the custom field to attach."""

    required: bool
    """Whether the value is required for this custom field."""


class BenefitCustomCreate(typing.TypedDict):
    """Schema to create a benefit of type `custom`."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["custom"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitCustomCreateProperties


class BenefitCustomCreateProperties(typing.TypedDict):
    """Properties for creating a benefit of type `custom`."""

    note: typing.NotRequired[str | None | None]


class BenefitCustomProperties(typing.TypedDict):
    """Properties for a benefit of type `custom`."""

    note: str | None | None


class BenefitCustomUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    type: typing.Literal["custom"]

    properties: typing.NotRequired[BenefitCustomProperties | None]


class BenefitDiscordCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["discord"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitDiscordCreateProperties


class BenefitDiscordCreateProperties(typing.TypedDict):
    """Properties to create a benefit of type `discord`."""

    guild_token: str

    role_id: str
    """The ID of the Discord role to grant."""

    kick_member: bool
    """Whether to kick the member from the Discord server on revocation."""


class BenefitDiscordUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    type: typing.Literal["discord"]

    properties: typing.NotRequired[BenefitDiscordCreateProperties | None]


class BenefitDownloadablesCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["downloadables"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitDownloadablesCreateProperties


class BenefitDownloadablesCreateProperties(typing.TypedDict):
    archived: typing.NotRequired[dict[str, bool]]

    files: list[str]


class BenefitDownloadablesUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    type: typing.Literal["downloadables"]

    properties: typing.NotRequired[BenefitDownloadablesCreateProperties | None]


class BenefitFeatureFlagCreate(typing.TypedDict):
    """Schema to create a benefit of type `feature_flag`."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["feature_flag"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitFeatureFlagCreateProperties


class BenefitFeatureFlagCreateProperties(typing.TypedDict):
    """Properties for creating a benefit of type `feature_flag`."""

    ...


class BenefitFeatureFlagProperties(typing.TypedDict):
    """Properties for a benefit of type `feature_flag`."""

    ...


class BenefitFeatureFlagUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    type: typing.Literal["feature_flag"]

    properties: typing.NotRequired[BenefitFeatureFlagProperties | None]


class BenefitGitHubRepositoryCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["github_repository"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitGitHubRepositoryCreateProperties


class BenefitGitHubRepositoryCreateProperties(typing.TypedDict):
    """Properties to create a benefit of type `github_repository`."""

    repository_owner: str
    """The owner of the repository."""

    repository_name: str
    """The name of the repository."""

    permission: Permission
    """The permission level to grant. Read more about roles and their permissions on [GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role)."""


class BenefitGitHubRepositoryUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    type: typing.Literal["github_repository"]

    properties: typing.NotRequired[BenefitGitHubRepositoryCreateProperties | None]


class BenefitLicenseKeyActivationCreateProperties(typing.TypedDict):
    limit: int

    enable_customer_admin: bool


class BenefitLicenseKeyExpirationProperties(typing.TypedDict):
    ttl: int

    timeframe: Timeframe


class BenefitLicenseKeysCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["license_keys"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitLicenseKeysCreateProperties


class BenefitLicenseKeysCreateProperties(typing.TypedDict):
    prefix: typing.NotRequired[str | None]

    expires: typing.NotRequired[BenefitLicenseKeyExpirationProperties | None]

    activations: typing.NotRequired[BenefitLicenseKeyActivationCreateProperties | None]

    limit_usage: typing.NotRequired[int | None]


class BenefitLicenseKeysUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    type: typing.Literal["license_keys"]

    properties: typing.NotRequired[BenefitLicenseKeysCreateProperties | None]


class BenefitMeterCreditCreate(typing.TypedDict):
    """Schema to create a benefit of type `meter_unit`."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["meter_credit"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitMeterCreditCreateProperties


class BenefitMeterCreditCreateProperties(typing.TypedDict):
    """Properties for creating a benefit of type `meter_unit`."""

    units: int

    rollover: bool

    meter_id: str


class BenefitMeterCreditUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    type: typing.Literal["meter_credit"]

    properties: typing.NotRequired[BenefitMeterCreditCreateProperties | None]


class BenefitSlackSharedChannelCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["slack_shared_channel"]

    description: str
    """The description of the benefit. Will be displayed on products having this benefit."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the benefit. **Required unless you use an organization token.**"""

    visibility: typing.NotRequired[BenefitVisibility | None]
    """The visibility of the benefit in the customer portal."""

    properties: BenefitSlackSharedChannelCreateProperties


class BenefitSlackSharedChannelCreateProperties(typing.TypedDict):
    slack_integration_id: str
    """Polar Slack integration to use for this benefit."""

    channel_name_template: str

    private: typing.NotRequired[bool]

    welcome_message: typing.NotRequired[str | None]

    archive_on_revoke: typing.NotRequired[bool]

    team_invitees: typing.NotRequired[list[str]]


class BenefitSlackSharedChannelUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    description: typing.NotRequired[str | None]
    """The description of the benefit. Will be displayed on products having this benefit."""

    type: typing.Literal["slack_shared_channel"]

    properties: typing.NotRequired[BenefitSlackSharedChannelCreateProperties | None]


class CheckoutConfirmStripe(typing.TypedDict):
    """Confirm a checkout session using a Stripe confirmation token."""

    custom_field_data: typing.NotRequired[dict[str, str | int | bool | str | None]]
    """Key-value object storing custom field values."""

    product_id: typing.NotRequired[str | None]
    """ID of the product to checkout. Must be present in the checkout's product list."""

    product_price_id: typing.NotRequired[str | None]
    """ID of the product price to checkout. Must correspond to a price present in the checkout's product list."""

    amount: typing.NotRequired[int | None]

    seats: typing.NotRequired[int | None]
    """Number of seats for seat-based pricing."""

    is_business_customer: typing.NotRequired[bool | None]

    customer_name: typing.NotRequired[str | None]

    customer_email: typing.NotRequired[str | None]

    customer_billing_name: typing.NotRequired[str | None]

    customer_billing_address: typing.NotRequired[AddressInput | None]

    customer_tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    discount_code: typing.NotRequired[str | None]
    """Discount code to apply to the checkout."""

    allow_trial: typing.NotRequired[typing.Literal[False] | None]
    """Disable the trial period for the checkout session. It's mainly useful when the trial is blocked because the customer already redeemed one."""

    confirmation_token_id: typing.NotRequired[str | None]
    """ID of the Stripe confirmation token. Required for fixed prices and custom prices."""


class CheckoutCreate(typing.TypedDict):
    """Create a new checkout session from a list of products.
    Customers will be able to switch between those products.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    custom_field_data: typing.NotRequired[dict[str, str | int | bool | str | None]]
    """Key-value object storing custom field values."""

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout."""

    allow_discount_codes: typing.NotRequired[bool]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`."""

    amount: typing.NotRequired[int | None]

    seats: typing.NotRequired[int | None]
    """Predefined number of seats (works with seat-based pricing only)"""

    min_seats: typing.NotRequired[int | None]
    """Minimum number of seats (works with seat-based pricing only)"""

    max_seats: typing.NotRequired[int | None]
    """Maximum number of seats (works with seat-based pricing only)"""

    allow_trial: typing.NotRequired[bool]
    """Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured."""

    customer_id: typing.NotRequired[str | None]
    """ID of an existing customer in the organization. The customer data will be pre-filled in the checkout form. The resulting order will be linked to this customer."""

    is_business_customer: typing.NotRequired[bool]
    """Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name."""

    external_customer_id: typing.NotRequired[str | None]
    """ID of the customer in your system. If a matching customer exists on Polar, the resulting order will be linked to this customer. Otherwise, a new customer will be created with this external ID set."""

    customer_name: typing.NotRequired[str | None]

    customer_email: typing.NotRequired[str | None]

    customer_ip_address: typing.NotRequired[str | None]

    customer_billing_name: typing.NotRequired[str | None]

    customer_billing_address: typing.NotRequired[AddressInput | None]

    customer_tax_id: typing.NotRequired[str | None]

    customer_metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information that'll be copied to the created customer.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    subscription_id: typing.NotRequired[str | None]
    """ID of a subscription to upgrade. It must be on a free pricing. If checkout is successful, metadata set on this checkout will be copied to the subscription, and existing keys will be overwritten."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""

    embed_origin: typing.NotRequired[str | None]
    """If you plan to embed the checkout session, set this to the Origin of the embedding page. It'll allow the Polar iframe to communicate with the parent page."""

    locale: typing.NotRequired[str | None]

    currency: typing.NotRequired[PresentmentCurrency | None]

    products: list[str]
    """List of product IDs available to select at that checkout. The first one will be selected by default."""

    prices: typing.NotRequired[
        dict[
            str,
            list[
                ProductPriceFixedCreate
                | ProductPriceCustomCreate
                | ProductPriceSeatBasedCreate
                | ProductPriceMeteredUnitCreate
            ],
        ]
        | None
    ]
    """Optional mapping of product IDs to a list of ad-hoc prices to create for that product. If not set, catalog prices of the product will be used."""


class CheckoutLinkCreateProduct(typing.TypedDict):
    """Schema to create a new checkout link from a a single product.

    **Deprecated**: Use `CheckoutLinkCreateProducts` instead."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    payment_processor: typing.Literal["stripe"]
    """Payment processor to use. Currently only Stripe is supported."""

    label: typing.NotRequired[str | None]
    """Optional label to distinguish links internally"""

    allow_discount_codes: typing.NotRequired[bool]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting."""

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored."""

    seats: typing.NotRequired[int | None]
    """Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""

    product_id: str


class CheckoutLinkCreateProductPrice(typing.TypedDict):
    """Schema to create a new checkout link from a a single product price.

    **Deprecated**: Use `CheckoutLinkCreateProducts` instead."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    payment_processor: typing.Literal["stripe"]
    """Payment processor to use. Currently only Stripe is supported."""

    label: typing.NotRequired[str | None]
    """Optional label to distinguish links internally"""

    allow_discount_codes: typing.NotRequired[bool]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting."""

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored."""

    seats: typing.NotRequired[int | None]
    """Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""

    product_price_id: str


class CheckoutLinkCreateProducts(typing.TypedDict):
    """Schema to create a new checkout link."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    payment_processor: typing.Literal["stripe"]
    """Payment processor to use. Currently only Stripe is supported."""

    label: typing.NotRequired[str | None]
    """Optional label to distinguish links internally"""

    allow_discount_codes: typing.NotRequired[bool]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting."""

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored."""

    seats: typing.NotRequired[int | None]
    """Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""

    products: list[str]
    """List of products that will be available to select at checkout."""


class CheckoutLinkUpdate(typing.TypedDict):
    """Schema to update an existing checkout link."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    products: typing.NotRequired[list[str] | None]
    """List of products that will be available to select at checkout."""

    label: typing.NotRequired[str | None]

    allow_discount_codes: typing.NotRequired[bool | None]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool | None]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting."""

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored."""

    seats: typing.NotRequired[int | None]
    """Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""


class CheckoutUpdate(typing.TypedDict):
    """Update an existing checkout session using an access token."""

    custom_field_data: typing.NotRequired[dict[str, str | int | bool | str | None]]
    """Key-value object storing custom field values."""

    product_id: typing.NotRequired[str | None]
    """ID of the product to checkout. Must be present in the checkout's product list."""

    product_price_id: typing.NotRequired[str | None]
    """ID of the product price to checkout. Must correspond to a price present in the checkout's product list."""

    amount: typing.NotRequired[int | None]

    seats: typing.NotRequired[int | None]
    """Number of seats for seat-based pricing."""

    is_business_customer: typing.NotRequired[bool | None]

    customer_name: typing.NotRequired[str | None]

    customer_email: typing.NotRequired[str | None]

    customer_billing_name: typing.NotRequired[str | None]

    customer_billing_address: typing.NotRequired[AddressInput | None]

    customer_tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    currency: typing.NotRequired[PresentmentCurrency | None]

    discount_id: typing.NotRequired[str | None]
    """ID of the discount to apply to the checkout."""

    allow_discount_codes: typing.NotRequired[bool | None]
    """Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it."""

    require_billing_address: typing.NotRequired[bool | None]
    """Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`."""

    allow_trial: typing.NotRequired[bool | None]
    """Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured."""

    customer_ip_address: typing.NotRequired[str | None]

    customer_metadata: typing.NotRequired[dict[str, str | int | float | bool] | None]
    """Key-value object allowing you to store additional information that'll be copied to the created customer.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    success_url: typing.NotRequired[str | None]
    """URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the checkout to return to this URL."""

    embed_origin: typing.NotRequired[str | None]
    """If you plan to embed the checkout session, set this to the Origin of the embedding page. It'll allow the Polar iframe to communicate with the parent page."""


class CheckoutUpdatePublic(typing.TypedDict):
    """Update an existing checkout session using the client secret."""

    custom_field_data: typing.NotRequired[dict[str, str | int | bool | str | None]]
    """Key-value object storing custom field values."""

    product_id: typing.NotRequired[str | None]
    """ID of the product to checkout. Must be present in the checkout's product list."""

    product_price_id: typing.NotRequired[str | None]
    """ID of the product price to checkout. Must correspond to a price present in the checkout's product list."""

    amount: typing.NotRequired[int | None]

    seats: typing.NotRequired[int | None]
    """Number of seats for seat-based pricing."""

    is_business_customer: typing.NotRequired[bool | None]

    customer_name: typing.NotRequired[str | None]

    customer_email: typing.NotRequired[str | None]

    customer_billing_name: typing.NotRequired[str | None]

    customer_billing_address: typing.NotRequired[AddressInput | None]

    customer_tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    discount_code: typing.NotRequired[str | None]
    """Discount code to apply to the checkout."""

    allow_trial: typing.NotRequired[typing.Literal[False] | None]
    """Disable the trial period for the checkout session. It's mainly useful when the trial is blocked because the customer already redeemed one."""


class CostMetadataInput(typing.TypedDict):
    amount: float | str
    """The amount in cents."""

    currency: str
    """The currency. Currently, only `usd` is supported."""


class CountAggregation(typing.TypedDict):
    func: typing.NotRequired[typing.Literal["count"]]


class CustomFieldCheckboxProperties(typing.TypedDict):
    form_label: typing.NotRequired[str]

    form_help_text: typing.NotRequired[str]

    form_placeholder: typing.NotRequired[str]


class CustomFieldCreateCheckbox(typing.TypedDict):
    """Schema to create a custom field of type checkbox."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["checkbox"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens."""

    name: str
    """Name of the custom field."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the custom field. **Required unless you use an organization token.**"""

    properties: CustomFieldCheckboxProperties


class CustomFieldCreateDate(typing.TypedDict):
    """Schema to create a custom field of type date."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["date"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens."""

    name: str
    """Name of the custom field."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the custom field. **Required unless you use an organization token.**"""

    properties: CustomFieldDateProperties


class CustomFieldCreateNumber(typing.TypedDict):
    """Schema to create a custom field of type number."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["number"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens."""

    name: str
    """Name of the custom field."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the custom field. **Required unless you use an organization token.**"""

    properties: CustomFieldNumberProperties


class CustomFieldCreateSelect(typing.TypedDict):
    """Schema to create a custom field of type select."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["select"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens."""

    name: str
    """Name of the custom field."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the custom field. **Required unless you use an organization token.**"""

    properties: CustomFieldSelectProperties


class CustomFieldCreateText(typing.TypedDict):
    """Schema to create a custom field of type text."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    type: typing.Literal["text"]

    slug: str
    """Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens."""

    name: str
    """Name of the custom field."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the custom field. **Required unless you use an organization token.**"""

    properties: CustomFieldTextProperties


class CustomFieldDateProperties(typing.TypedDict):
    form_label: typing.NotRequired[str]

    form_help_text: typing.NotRequired[str]

    form_placeholder: typing.NotRequired[str]

    ge: typing.NotRequired[int]

    le: typing.NotRequired[int]


class CustomFieldNumberProperties(typing.TypedDict):
    form_label: typing.NotRequired[str]

    form_help_text: typing.NotRequired[str]

    form_placeholder: typing.NotRequired[str]

    ge: typing.NotRequired[int]

    le: typing.NotRequired[int]


class CustomFieldSelectOption(typing.TypedDict):
    value: str

    label: str


class CustomFieldSelectProperties(typing.TypedDict):
    form_label: typing.NotRequired[str]

    form_help_text: typing.NotRequired[str]

    form_placeholder: typing.NotRequired[str]

    options: list[CustomFieldSelectOption]


class CustomFieldTextProperties(typing.TypedDict):
    form_label: typing.NotRequired[str]

    form_help_text: typing.NotRequired[str]

    form_placeholder: typing.NotRequired[str]

    textarea: typing.NotRequired[bool]

    min_length: typing.NotRequired[int]

    max_length: typing.NotRequired[int]


class CustomFieldUpdateCheckbox(typing.TypedDict):
    """Schema to update a custom field of type checkbox."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    slug: typing.NotRequired[str | None]

    type: typing.Literal["checkbox"]

    properties: typing.NotRequired[CustomFieldCheckboxProperties | None]


class CustomFieldUpdateDate(typing.TypedDict):
    """Schema to update a custom field of type date."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    slug: typing.NotRequired[str | None]

    type: typing.Literal["date"]

    properties: typing.NotRequired[CustomFieldDateProperties | None]


class CustomFieldUpdateNumber(typing.TypedDict):
    """Schema to update a custom field of type number."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    slug: typing.NotRequired[str | None]

    type: typing.Literal["number"]

    properties: typing.NotRequired[CustomFieldNumberProperties | None]


class CustomFieldUpdateSelect(typing.TypedDict):
    """Schema to update a custom field of type select."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    slug: typing.NotRequired[str | None]

    type: typing.Literal["select"]

    properties: typing.NotRequired[CustomFieldSelectProperties | None]


class CustomFieldUpdateText(typing.TypedDict):
    """Schema to update a custom field of type text."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    slug: typing.NotRequired[str | None]

    type: typing.Literal["text"]

    properties: typing.NotRequired[CustomFieldTextProperties | None]


class CustomerBenefitGrantCustomUpdate(typing.TypedDict):
    benefit_type: typing.Literal["custom"]


class CustomerBenefitGrantDiscordPropertiesUpdate(typing.TypedDict):
    account_id: str | None


class CustomerBenefitGrantDiscordUpdate(typing.TypedDict):
    benefit_type: typing.Literal["discord"]

    properties: CustomerBenefitGrantDiscordPropertiesUpdate


class CustomerBenefitGrantDownloadablesUpdate(typing.TypedDict):
    benefit_type: typing.Literal["downloadables"]


class CustomerBenefitGrantFeatureFlagUpdate(typing.TypedDict):
    benefit_type: typing.Literal["feature_flag"]


class CustomerBenefitGrantGitHubRepositoryPropertiesUpdate(typing.TypedDict):
    account_id: str | None


class CustomerBenefitGrantGitHubRepositoryUpdate(typing.TypedDict):
    benefit_type: typing.Literal["github_repository"]

    properties: CustomerBenefitGrantGitHubRepositoryPropertiesUpdate


class CustomerBenefitGrantLicenseKeysUpdate(typing.TypedDict):
    benefit_type: typing.Literal["license_keys"]


class CustomerBenefitGrantMeterCreditUpdate(typing.TypedDict):
    benefit_type: typing.Literal["meter_credit"]


class CustomerBenefitGrantSlackSharedChannelPropertiesUpdate(typing.TypedDict):
    invited_email: str


class CustomerBenefitGrantSlackSharedChannelUpdate(typing.TypedDict):
    benefit_type: typing.Literal["slack_shared_channel"]

    properties: CustomerBenefitGrantSlackSharedChannelPropertiesUpdate


class CustomerEmailUpdateRequest(typing.TypedDict):
    email: str


class CustomerEmailUpdateVerifyRequest(typing.TypedDict):
    token: str


class CustomerIndividualCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    external_id: typing.NotRequired[str | None]
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    name: typing.NotRequired[str | None]

    billing_address: typing.NotRequired[AddressInput | None]

    tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the customer. **Required unless you use an organization token.**"""

    owner: typing.NotRequired[MemberOwnerCreate | None]
    """Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer's email and name."""

    type: typing.NotRequired[typing.Literal["individual"]]

    email: str
    """The email address of the customer. This must be unique within the organization."""


class CustomerOrderConfirmPayment(typing.TypedDict):
    """Schema to confirm a retry payment using either a saved payment method or a new confirmation token."""

    confirmation_token_id: typing.NotRequired[str | None]
    """ID of the Stripe confirmation token for new payment methods."""

    payment_method_id: typing.NotRequired[str | None]
    """ID of an existing saved payment method."""

    payment_processor: typing.NotRequired[PaymentProcessor]


class CustomerOrderUpdate(typing.TypedDict):
    """Schema to update an order."""

    billing_name: typing.NotRequired[str | None]
    """The name of the customer that should appear on the invoice."""

    billing_address: typing.NotRequired[AddressInput | None]
    """The address of the customer that should appear on the invoice. Country and state fields cannot be updated."""


class CustomerPaymentMethodConfirm(typing.TypedDict):
    setup_intent_id: str

    set_default: bool


class CustomerPaymentMethodCreate(typing.TypedDict):
    confirmation_token_id: str

    set_default: bool

    return_url: str


class CustomerPortalCustomerSettings(typing.TypedDict):
    allow_email_change: typing.NotRequired[bool]


class CustomerPortalCustomerUpdate(typing.TypedDict):
    billing_name: typing.NotRequired[str | None]

    billing_address: typing.NotRequired[AddressInput | None]

    tax_id: typing.NotRequired[str | None]

    default_payment_method_id: typing.NotRequired[str | None]


class CustomerPortalMemberCreate(typing.TypedDict):
    """Schema for adding a new member to the customer's team."""

    email: str
    """The email address of the new member."""

    name: typing.NotRequired[str | None]
    """The name of the new member (optional)."""

    role: typing.NotRequired[MemberRole]


class CustomerPortalMemberUpdate(typing.TypedDict):
    """Schema for updating a member in the customer portal."""

    name: typing.NotRequired[str | None]
    """The new name for the member."""

    role: typing.NotRequired[MemberRole | None]
    """The new role for the member."""


class CustomerPortalSubscriptionSettings(typing.TypedDict):
    update_seats: bool

    update_plan: bool


class CustomerPortalUsageSettings(typing.TypedDict):
    show: bool


class CustomerSeatAssign(typing.TypedDict):
    subscription_id: typing.NotRequired[str | None]
    """Subscription ID. Required if neither order_id nor checkout_id is provided."""

    order_id: typing.NotRequired[str | None]
    """Order ID for one-time purchases. Required if subscription_id is not provided."""

    email: typing.NotRequired[str | None]
    """Email of the customer to assign the seat to"""

    external_customer_id: typing.NotRequired[str | None]
    """External customer ID for the seat assignment"""

    customer_id: typing.NotRequired[str | None]
    """Customer ID for the seat assignment"""

    external_member_id: typing.NotRequired[str | None]
    """External member ID for the seat assignment. Can be used alone (lookup existing member) or with email (create/validate member)."""

    member_id: typing.NotRequired[str | None]
    """Member ID for the seat assignment."""

    metadata: typing.NotRequired[dict[str, typing.Any] | None]
    """Additional metadata for the seat (max 10 keys, 1KB total)"""

    immediate_claim: typing.NotRequired[bool]
    """If true, the seat will be immediately claimed without sending an invitation email. API-only feature."""

    checkout_id: typing.NotRequired[str | None]
    """Checkout ID. Resolves to the subscription or order produced by the checkout."""


class CustomerSessionCustomerExternalIDCreate(typing.TypedDict):
    """Schema for creating a customer session using an external customer ID."""

    member_id: typing.NotRequired[str | None]
    """ID of the member to create a session for. When not provided and the organization has `member_model_enabled`, the owner member of the customer will be used for individual customers."""

    external_member_id: typing.NotRequired[str | None]
    """External ID of the member to create a session for. Alternative to `member_id`."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the customer portal to return to this URL."""

    external_customer_id: str
    """External ID of the customer to create a session for."""


class CustomerSessionCustomerIDCreate(typing.TypedDict):
    """Schema for creating a customer session using a customer ID."""

    member_id: typing.NotRequired[str | None]
    """ID of the member to create a session for. When not provided and the organization has `member_model_enabled`, the owner member of the customer will be used for individual customers."""

    external_member_id: typing.NotRequired[str | None]
    """External ID of the member to create a session for. Alternative to `member_id`."""

    return_url: typing.NotRequired[str | None]
    """When set, a back button will be shown in the customer portal to return to this URL."""

    customer_id: str
    """ID of the customer to create a session for."""


class CustomerSubscriptionCancel(typing.TypedDict):
    cancel_at_period_end: typing.NotRequired[bool | None]
    """Cancel an active subscription once the current period ends.

Or uncancel a subscription currently set to be revoked at period end."""

    cancellation_reason: typing.NotRequired[CustomerCancellationReason | None]
    """Customers reason for cancellation.

* `too_expensive`: Too expensive for the customer.
* `missing_features`: Customer is missing certain features.
* `switched_service`: Customer switched to another service.
* `unused`: Customer is not using it enough.
* `customer_service`: Customer is not satisfied with the customer service.
* `low_quality`: Customer is unhappy with the quality.
* `too_complex`: Customer considers the service too complicated.
* `other`: Other reason(s)."""

    cancellation_comment: typing.NotRequired[str | None]
    """Customer feedback and why they decided to cancel."""


class CustomerSubscriptionUpdateClear(typing.TypedDict):
    pending_update: None
    """Clear the pending subscription update."""


class CustomerSubscriptionUpdateProduct(typing.TypedDict):
    product_id: str
    """Update subscription to another product."""


class CustomerSubscriptionUpdateSeats(typing.TypedDict):
    seats: int
    """Update the number of seats for this subscription."""

    proration_behavior: typing.NotRequired[SubscriptionProrationBehavior | None]
    """Determine how to handle the proration billing. If not provided, will use the default organization setting."""


class CustomerTeamCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    external_id: typing.NotRequired[str | None]
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    name: typing.NotRequired[str | None]

    billing_address: typing.NotRequired[AddressInput | None]

    tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the customer. **Required unless you use an organization token.**"""

    owner: typing.NotRequired[MemberOwnerCreate | None]
    """Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer's email and name."""

    type: typing.Literal["team"]

    email: typing.NotRequired[str | None]
    """The email address of the team customer. Optional for team customers — if omitted, an owner with an email must be provided."""


class CustomerUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    email: typing.NotRequired[str | None]
    """The email address of the customer. This must be unique within the organization."""

    name: typing.NotRequired[str | None]

    billing_address: typing.NotRequired[AddressInput | None]

    tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]

    external_id: typing.NotRequired[str | None]
    """The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated."""

    type: typing.NotRequired[CustomerType | None]
    """The customer type. Can only be upgraded from 'individual' to 'team', never downgraded."""


class CustomerUpdateExternalID(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    email: typing.NotRequired[str | None]
    """The email address of the customer. This must be unique within the organization."""

    name: typing.NotRequired[str | None]

    billing_address: typing.NotRequired[AddressInput | None]

    tax_id: typing.NotRequired[str | None]

    locale: typing.NotRequired[str | None]


class DiscountFixedCreate(typing.TypedDict):
    """Schema to create a fixed amount discount."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: typing.NotRequired[str | None]
    """Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API."""

    starts_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is redeemable."""

    ends_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is no longer redeemable."""

    max_redemptions: typing.NotRequired[int | None]
    """Optional maximum number of times the discount can be redeemed."""

    products: typing.NotRequired[list[str] | None]

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the discount. **Required unless you use an organization token.**"""

    type: typing.NotRequired[typing.Literal["fixed"]]

    duration: DiscountDuration

    duration_in_months: typing.NotRequired[int | None]
    """Number of months the discount should be applied.

Required when `duration` is `repeating`. Must be omitted otherwise.

For this to work on yearly pricing, you should multiply this by 12.
For example, to apply the discount for 2 years, set this to 24."""

    amount: typing.NotRequired[int | None]

    currency: typing.NotRequired[PresentmentCurrency | None]

    amounts: typing.NotRequired[dict[str, int] | None]


class DiscountPercentageCreate(typing.TypedDict):
    """Schema to create a percentage discount."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: str
    """Name of the discount. Will be displayed to the customer when the discount is applied."""

    code: typing.NotRequired[str | None]
    """Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API."""

    starts_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is redeemable."""

    ends_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is no longer redeemable."""

    max_redemptions: typing.NotRequired[int | None]
    """Optional maximum number of times the discount can be redeemed."""

    products: typing.NotRequired[list[str] | None]

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the discount. **Required unless you use an organization token.**"""

    type: typing.NotRequired[typing.Literal["percentage"]]

    duration: DiscountDuration

    duration_in_months: typing.NotRequired[int | None]
    """Number of months the discount should be applied.

Required when `duration` is `repeating`. Must be omitted otherwise.

For this to work on yearly pricing, you should multiply this by 12.
For example, to apply the discount for 2 years, set this to 24."""

    basis_points: int
    """Discount percentage in basis points.

A basis point is 1/100th of a percent.
For example, to create a 25.5% discount, set this to 2550."""


class DiscountUpdate(typing.TypedDict):
    """Schema to update a discount."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]

    code: typing.NotRequired[str | None]
    """Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API."""

    starts_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is redeemable."""

    ends_at: typing.NotRequired[str | None]
    """Optional timestamp after which the discount is no longer redeemable."""

    max_redemptions: typing.NotRequired[int | None]
    """Optional maximum number of times the discount can be redeemed."""

    duration: typing.NotRequired[DiscountDuration | None]

    duration_in_months: typing.NotRequired[int | None]

    type: typing.NotRequired[DiscountType | None]

    amount: typing.NotRequired[int | None]

    currency: typing.NotRequired[PresentmentCurrency | None]

    amounts: typing.NotRequired[dict[str, int] | None]

    basis_points: typing.NotRequired[int | None]

    products: typing.NotRequired[list[str] | None]


class DownloadableFileCreate(typing.TypedDict):
    """Schema to create a file to be associated with the downloadables benefit."""

    organization_id: typing.NotRequired[str | None]

    name: str

    mime_type: str

    size: int

    checksum_sha256_base64: typing.NotRequired[str | None]

    upload: S3FileCreateMultipart

    service: typing.Literal["downloadable"]

    version: typing.NotRequired[str | None]


class EventCreateCustomer(typing.TypedDict):
    timestamp: typing.NotRequired[str]
    """The timestamp of the event."""

    name: str
    """The name of the event."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the event. **Required unless you use an organization token.**"""

    external_id: typing.NotRequired[str | None]
    """Your unique identifier for this event. Useful for deduplication and parent-child relationships."""

    parent_id: typing.NotRequired[str | None]
    """The ID of the parent event. Can be either a Polar event ID (UUID) or an external event ID."""

    metadata: typing.NotRequired[EventMetadataInput]

    customer_id: str
    """ID of the customer in your Polar organization associated with the event."""

    member_id: typing.NotRequired[str | None]
    """ID of the member within the customer's organization who performed the action. Used for member-level attribution in B2B."""


class EventCreateExternalCustomer(typing.TypedDict):
    timestamp: typing.NotRequired[str]
    """The timestamp of the event."""

    name: str
    """The name of the event."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the event. **Required unless you use an organization token.**"""

    external_id: typing.NotRequired[str | None]
    """Your unique identifier for this event. Useful for deduplication and parent-child relationships."""

    parent_id: typing.NotRequired[str | None]
    """The ID of the parent event. Can be either a Polar event ID (UUID) or an external event ID."""

    metadata: typing.NotRequired[EventMetadataInput]

    external_customer_id: str
    """ID of the customer in your system associated with the event."""

    external_member_id: typing.NotRequired[str | None]
    """ID of the member in your system within the customer's organization who performed the action. Used for member-level attribution in B2B."""


class EventMetadataInput(typing.TypedDict):
    _cost: typing.NotRequired[CostMetadataInput]

    _llm: typing.NotRequired[LLMMetadata]


class EventTypeUpdate(typing.TypedDict):
    label: str
    """The label for the event type."""

    label_property_selector: typing.NotRequired[str | None]
    """Property path to extract dynamic label from event metadata (e.g., 'subject' or 'metadata.subject')."""


class EventsIngest(typing.TypedDict):
    events: list[EventCreateCustomer | EventCreateExternalCustomer]
    """List of events to ingest."""


class ExistingProductPrice(typing.TypedDict):
    """A price that already exists for this product.

    Useful when updating a product if you want to keep an existing price."""

    id: str


class FilePatch(typing.TypedDict):
    name: typing.NotRequired[str | None]

    version: typing.NotRequired[str | None]


class FileUploadCompleted(typing.TypedDict):
    id: str

    path: str

    parts: list[S3FileUploadCompletedPart]


class Filter(typing.TypedDict):
    conjunction: FilterConjunction

    clauses: list[FilterClause | Filter]


class FilterClause(typing.TypedDict):
    property: str

    operator: FilterOperator

    value: str | int | bool


class LLMMetadata(typing.TypedDict):
    vendor: str
    """The vendor of the event."""

    model: str
    """The model used for the event."""

    prompt: typing.NotRequired[str | None]
    """The LLM prompt used for the event."""

    response: typing.NotRequired[str | None]
    """The LLM response used for the event."""

    input_tokens: int
    """The number of LLM input tokens used for the event."""

    cached_input_tokens: typing.NotRequired[int]
    """The number of LLM cached tokens that were used for the event."""

    output_tokens: int
    """The number of LLM output tokens used for the event."""

    total_tokens: int
    """The total number of LLM tokens used for the event."""


class LicenseKeyActivate(typing.TypedDict):
    key: str

    organization_id: str

    label: str

    conditions: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to set conditions that must match when validating the license key.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    meta: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information about the activation

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""


class LicenseKeyDeactivate(typing.TypedDict):
    key: str

    organization_id: str

    activation_id: str


class LicenseKeyUpdate(typing.TypedDict):
    status: typing.NotRequired[LicenseKeyStatus | None]

    usage: typing.NotRequired[int]

    limit_activations: typing.NotRequired[int | None]

    limit_usage: typing.NotRequired[int | None]

    expires_at: typing.NotRequired[str | None]


class LicenseKeyValidate(typing.TypedDict):
    key: str

    organization_id: str

    activation_id: typing.NotRequired[str | None]

    benefit_id: typing.NotRequired[str | None]

    customer_id: typing.NotRequired[str | None]

    increment_usage: typing.NotRequired[int | None]

    conditions: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to set conditions that must match when validating the license key.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""


class MemberCreateFromCustomer(typing.TypedDict):
    """Schema for creating a new member nested under a customer.

    The customer is taken from the URL path, so it's not part of the body."""

    email: str
    """The email address of the member."""

    name: typing.NotRequired[str | None]

    external_id: typing.NotRequired[str | None]
    """The ID of the member in your system. This must be unique within the customer. """

    role: typing.NotRequired[Role]
    """The role of the member within the customer. To assign or transfer ownership, use the member update endpoint."""


class MemberOwnerCreate(typing.TypedDict):
    """Schema for creating an owner member during customer creation."""

    email: str
    """The email address of the member."""

    name: typing.NotRequired[str | None]

    external_id: typing.NotRequired[str | None]
    """The ID of the member in your system. This must be unique within the customer. """


class MemberUpdate(typing.TypedDict):
    """Schema for updating a member."""

    name: typing.NotRequired[str | None]

    email: typing.NotRequired[str | None]

    role: typing.NotRequired[MemberRole | None]
    """The role of the member within the customer."""


class MeterCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: str
    """The name of the meter. Will be shown on customer's invoices and usage."""

    unit: typing.NotRequired[MeterUnit]

    custom_label: typing.NotRequired[str | None]
    """The label for the custom unit, e.g. 'request'. Required when unit is 'custom'."""

    custom_multiplier: typing.NotRequired[int | None]
    """The multiplier to convert from the base unit to display scale, e.g. 1000 to display per 1000 units. Defaults to 1 when not provided."""

    filter: Filter

    aggregation: CountAggregation | PropertyAggregation | UniqueAggregation
    """The aggregation to apply on the filtered events to calculate the meter."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the meter. **Required unless you use an organization token.**"""


class MeterUpdate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: typing.NotRequired[str | None]
    """The name of the meter. Will be shown on customer's invoices and usage."""

    unit: typing.NotRequired[MeterUnit | None]
    """The unit of the meter."""

    custom_label: typing.NotRequired[str | None]
    """The label for the custom unit. Required when unit is 'custom'."""

    custom_multiplier: typing.NotRequired[int | None]
    """The multiplier to convert from base unit to display scale. Required when unit is 'custom'."""

    filter: typing.NotRequired[Filter | None]
    """The filter to apply on events that'll be used to calculate the meter."""

    aggregation: typing.NotRequired[
        CountAggregation | PropertyAggregation | UniqueAggregation | None
    ]
    """The aggregation to apply on the filtered events to calculate the meter."""

    is_archived: typing.NotRequired[bool | None]
    """Whether the meter is archived. Archived meters are no longer used for billing."""


class MetricDashboardCreate(typing.TypedDict):
    """Schema for creating a metrics dashboard."""

    name: str
    """Display name for the dashboard."""

    metrics: typing.NotRequired[list[str]]
    """List of metric slugs to display in this dashboard."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning this dashboard. **Required unless you use an organization token.**"""


class MetricDashboardUpdate(typing.TypedDict):
    """Schema for updating a metrics dashboard."""

    name: typing.NotRequired[str | None]
    """Display name for the dashboard."""

    metrics: typing.NotRequired[list[str] | None]
    """List of metric slugs to display in this dashboard."""


class OAuth2ClientConfiguration(typing.TypedDict):
    redirect_uris: list[str]

    token_endpoint_auth_method: typing.NotRequired[TokenEndpointAuthMethod]

    grant_types: typing.NotRequired[
        list[
            typing.Literal["authorization_code"] | typing.Literal["refresh_token"]
        ]
    ]

    response_types: typing.NotRequired[list[typing.Literal["code"]]]

    scope: typing.NotRequired[str]

    client_name: str

    client_uri: typing.NotRequired[str | None]

    logo_uri: typing.NotRequired[str | None]

    tos_uri: typing.NotRequired[str | None]

    policy_uri: typing.NotRequired[str | None]

    default_sub_type: typing.NotRequired[SubType]


class OAuth2ClientConfigurationUpdate(typing.TypedDict):
    redirect_uris: list[str]

    token_endpoint_auth_method: typing.NotRequired[TokenEndpointAuthMethod]

    grant_types: typing.NotRequired[
        list[
            typing.Literal["authorization_code"] | typing.Literal["refresh_token"]
        ]
    ]

    response_types: typing.NotRequired[list[typing.Literal["code"]]]

    scope: typing.NotRequired[str]

    client_name: str

    client_uri: typing.NotRequired[str | None]

    logo_uri: typing.NotRequired[str | None]

    tos_uri: typing.NotRequired[str | None]

    policy_uri: typing.NotRequired[str | None]

    default_sub_type: typing.NotRequired[SubType]

    client_id: str


class OrderCreate(typing.TypedDict):
    """Schema to create a draft order for an off-session charge."""

    custom_field_data: typing.NotRequired[dict[str, str | int | bool | str | None]]
    """Key-value object storing custom field values."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization the order belongs to. **Required unless you use an organization token.** The customer and product must belong to this organization."""

    customer_id: str
    """The ID of the customer the order is for. Must belong to the order's organization."""

    product_id: str
    """The ID of the one-time product to charge for. Must belong to the order's organization. Only fixed-price and free products are supported."""

    currency: typing.NotRequired[str | None]
    """The currency to charge in (ISO 4217, lowercase, e.g. `usd`). Defaults to the organization's default currency; specify it to force a different one, or when the product isn't priced in the organization's default currency."""

    amount: typing.NotRequired[int | None]
    """A custom amount to charge, in the smallest currency unit. Overrides the product's price; defaults to the product's configured price (0 for free products). A positive amount must be at least the currency's minimum."""

    description: typing.NotRequired[str | None]
    """A custom description for the order's line item, shown on the invoice and receipt (e.g. `5,000 tokens`). Defaults to the product name."""


class OrderFinalize(typing.TypedDict):
    """Schema to finalize a draft order and trigger an off-session charge."""

    payment_method_id: typing.NotRequired[str | None]
    """ID of the payment method to charge. Must belong to the order's customer. Falls back to the customer's default payment method when unset."""


class OrderUpdate(typing.TypedDict):
    """Schema to update an order."""

    billing_name: typing.NotRequired[str | None]
    """The name of the customer that should appear on the invoice."""

    billing_address: typing.NotRequired[AddressInput | None]
    """The address of the customer that should appear on the invoice. Country and state fields cannot be updated."""


class OrganizationAvatarFileCreate(typing.TypedDict):
    """Schema to create a file to be used as an organization avatar."""

    organization_id: typing.NotRequired[str | None]

    name: str

    mime_type: str
    """MIME type of the file. Only images are supported for this type of file."""

    size: int
    """Size of the file. A maximum of 1 MB is allowed for this type of file."""

    checksum_sha256_base64: typing.NotRequired[str | None]

    upload: S3FileCreateMultipart

    service: typing.Literal["organization_avatar"]

    version: typing.NotRequired[str | None]


class OrganizationCompanyLegalEntitySchema(typing.TypedDict):
    type: typing.Literal["company"]

    registered_name: str


class OrganizationCreate(typing.TypedDict):
    name: str

    slug: str

    avatar_url: typing.NotRequired[str | None]

    legal_entity: typing.NotRequired[
        OrganizationIndividualLegalEntitySchema
        | OrganizationCompanyLegalEntitySchema
        | None
    ]

    email: typing.NotRequired[str | None]
    """Public support email."""

    website: typing.NotRequired[str | None]
    """Official website of the organization."""

    socials: typing.NotRequired[list[OrganizationSocialLink] | None]
    """Link to social profiles."""

    details: typing.NotRequired[OrganizationDetails | None]
    """Additional, private, business details Polar needs about active organizations for compliance (KYC)."""

    country: typing.NotRequired[CountryAlpha2Input | None]
    """Two-letter country code (ISO 3166-1 alpha-2)."""

    feature_settings: typing.NotRequired[OrganizationFeatureSettingsUpdate | None]

    subscription_settings: typing.NotRequired[OrganizationSubscriptionSettings | None]

    customer_email_settings: typing.NotRequired[
        OrganizationCustomerEmailSettings | None
    ]

    customer_portal_settings: typing.NotRequired[
        OrganizationCustomerPortalSettings | None
    ]

    default_presentment_currency: typing.NotRequired[PresentmentCurrency]

    default_tax_behavior: typing.NotRequired[TaxBehaviorOption]


class OrganizationCustomerEmailSettings(typing.TypedDict):
    order_confirmation: bool

    subscription_cancellation: bool

    subscription_confirmation: bool

    subscription_cycled: bool

    subscription_cycled_after_trial: bool

    subscription_past_due: bool

    subscription_renewal_reminder: bool

    subscription_revoked: bool

    subscription_trial_conversion_reminder: bool

    subscription_uncanceled: bool

    subscription_updated: bool


class OrganizationCustomerPortalSettings(typing.TypedDict):
    usage: CustomerPortalUsageSettings

    subscription: CustomerPortalSubscriptionSettings

    customer: typing.NotRequired[CustomerPortalCustomerSettings]


class OrganizationDetails(typing.TypedDict):
    about: typing.NotRequired[str | None]
    """Brief information about you and your business."""

    product_description: typing.NotRequired[str | None]
    """Description of digital products being sold."""

    selling_categories: typing.NotRequired[list[str]]
    """Categories of products being sold."""

    pricing_models: typing.NotRequired[list[str]]
    """Pricing models used by the organization."""

    intended_use: typing.NotRequired[str | None]
    """How the organization will integrate and use Polar."""

    customer_acquisition: typing.NotRequired[list[str]]
    """Main customer acquisition channels."""

    future_annual_revenue: typing.NotRequired[int | None]
    """Estimated revenue in the next 12 months"""

    switching: typing.NotRequired[bool]
    """Switching from another platform?"""

    switching_from: typing.NotRequired[
        typing.Literal["paddle"]
        | typing.Literal["lemon_squeezy"]
        | typing.Literal["gumroad"]
        | typing.Literal["stripe"]
        | typing.Literal["other"]
        | None
    ]
    """Which platform the organization is migrating from."""

    previous_annual_revenue: typing.NotRequired[int | None]
    """Revenue from last year if applicable."""


class OrganizationFeatureSettingsUpdate(typing.TypedDict):
    """Feature settings that organizations can update themselves.

    Other feature settings are managed by Polar staff: they're ignored if
    provided and keep their current value."""

    seat_based_pricing_enabled: typing.NotRequired[bool]
    """If this organization has seat-based pricing enabled"""

    member_model_enabled: typing.NotRequired[bool]
    """If this organization has the Member model enabled"""

    checkout_localization_enabled: typing.NotRequired[bool]
    """If this organization has checkout localization enabled"""

    overview_metrics: typing.NotRequired[list[str] | None]
    """Ordered list of metric slugs shown on the dashboard overview."""


class OrganizationIndividualLegalEntitySchema(typing.TypedDict):
    type: typing.Literal["individual"]


class OrganizationSocialLink(typing.TypedDict):
    platform: OrganizationSocialPlatforms

    url: str
    """The URL to the organization profile"""


class OrganizationSubscriptionSettings(typing.TypedDict):
    allow_multiple_subscriptions: bool

    proration_behavior: PublicSubscriptionProrationBehavior

    benefit_revocation_grace_period: int

    prevent_trial_abuse: bool

    allow_customer_updates: bool


class OrganizationUpdate(typing.TypedDict):
    name: typing.NotRequired[str | None]

    avatar_url: typing.NotRequired[str | None]

    email: typing.NotRequired[str | None]
    """Public support email."""

    website: typing.NotRequired[str | None]
    """Official website of the organization."""

    socials: typing.NotRequired[list[OrganizationSocialLink] | None]
    """Links to social profiles."""

    details: typing.NotRequired[OrganizationDetails | None]
    """Additional, private, business details Polar needs about active organizations for compliance (KYC)."""

    country: typing.NotRequired[CountryAlpha2Input | None]
    """Two-letter country code (ISO 3166-1 alpha-2)."""

    feature_settings: typing.NotRequired[OrganizationFeatureSettingsUpdate | None]

    subscription_settings: typing.NotRequired[OrganizationSubscriptionSettings | None]

    customer_email_settings: typing.NotRequired[
        OrganizationCustomerEmailSettings | None
    ]

    customer_portal_settings: typing.NotRequired[
        OrganizationCustomerPortalSettings | None
    ]

    default_presentment_currency: typing.NotRequired[PresentmentCurrency | None]
    """Default presentment currency for the organization"""

    default_tax_behavior: typing.NotRequired[TaxBehaviorOption | None]
    """Default tax behavior applied on products."""

    sso_enforced: typing.NotRequired[bool | None]
    """Whether members must access this organization through its SSO connection. Turning this on requires an active SSO session for this organization and at least one enabled SSO connection."""


class ProductBenefitsUpdate(typing.TypedDict):
    """Schema to update the benefits granted by a product."""

    benefits: list[str]
    """List of benefit IDs. Each one must be on the same organization as the product."""


class ProductCreateOneTime(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: str
    """The name of the product."""

    description: typing.NotRequired[str | None]
    """The description of the product."""

    visibility: typing.NotRequired[ProductVisibility]

    prices: list[
        ProductPriceFixedCreate
        | ProductPriceCustomCreate
        | ProductPriceSeatBasedCreate
        | ProductPriceMeteredUnitCreate
    ]
    """List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products."""

    medias: typing.NotRequired[list[str] | None]
    """List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded."""

    attached_custom_fields: typing.NotRequired[list[AttachedCustomFieldCreate]]
    """List of custom fields to attach."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the product. **Required unless you use an organization token.**"""

    recurring_interval: typing.NotRequired[None]
    """States that the product is a one-time purchase."""

    recurring_interval_count: typing.NotRequired[None]
    """One-time products don't have a recurring interval count."""


class ProductCreateRecurring(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    name: str
    """The name of the product."""

    description: typing.NotRequired[str | None]
    """The description of the product."""

    visibility: typing.NotRequired[ProductVisibility]

    prices: list[
        ProductPriceFixedCreate
        | ProductPriceCustomCreate
        | ProductPriceSeatBasedCreate
        | ProductPriceMeteredUnitCreate
    ]
    """List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products."""

    medias: typing.NotRequired[list[str] | None]
    """List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded."""

    attached_custom_fields: typing.NotRequired[list[AttachedCustomFieldCreate]]
    """List of custom fields to attach."""

    organization_id: typing.NotRequired[str | None]
    """The ID of the organization owning the product. **Required unless you use an organization token.**"""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    recurring_interval: RecurringInterval

    recurring_interval_count: typing.NotRequired[int]
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on."""

    meter_interval: typing.NotRequired[RecurringInterval | None]
    """Optional meter cycle, independent of the billing interval. When set, overage settlement, meter resets and meter-credit grants run on this cadence rather than the billing interval — e.g. yearly billing with monthly credits. It must evenly divide the billing interval. If `None`, metered concerns follow the billing interval. **Once set, it can't be changed.**"""

    meter_interval_count: typing.NotRequired[int | None]
    """Number of meter interval units. Defaults to 1 when `meter_interval` is set. Ignored when `meter_interval` is `None`."""


class ProductMediaFileCreate(typing.TypedDict):
    """Schema to create a file to be used as a product media file."""

    organization_id: typing.NotRequired[str | None]

    name: str

    mime_type: str
    """MIME type of the file. Only images are supported for this type of file."""

    size: int
    """Size of the file. A maximum of 10 MB is allowed for this type of file."""

    checksum_sha256_base64: typing.NotRequired[str | None]

    upload: S3FileCreateMultipart

    service: typing.Literal["product_media"]

    version: typing.NotRequired[str | None]


class ProductPriceCustomCreate(typing.TypedDict):
    """Schema to create a pay-what-you-want price."""

    amount_type: typing.Literal["custom"]

    price_currency: typing.NotRequired[PresentmentCurrency]

    tax_behavior: typing.NotRequired[TaxBehaviorOption | None]
    """The tax behavior of the price. If not set, it will default to the organization's default tax behavior."""

    minimum_amount: typing.NotRequired[int]
    """The minimum amount the customer can pay. If set to 0, the price is 'free or pay what you want' and $0 is accepted. If set to a value below the minimum price amount for the currency, it will be rejected. Defaults to the minimum price amount for the currency. Minimum per currency:
- USD: 0.5
- AED: 2
- ALL: 50
- AMD: 200
- AOA: 500
- ARS: 750
- AUD: 0.7
- AWG: 1
- AZN: 1
- BAM: 1
- BBD: 2
- BDT: 70
- BIF: 2,000
- BMD: 1
- BND: 1
- BOB: 5
- BRL: 2.5
- BSD: 1
- BWP: 10
- BZD: 2
- CAD: 0.7
- CDF: 2,000
- CHF: 0.5
- CLP: 500
- CNY: 5
- COP: 2,000
- CRC: 300
- CVE: 50
- CZK: 15
- DJF: 100
- DKK: 3.2
- DOP: 40
- DZD: 70
- EGP: 30
- ETB: 80
- EUR: 0.5
- FJD: 2
- FKP: 1
- GBP: 0.4
- GEL: 2
- GNF: 5,000
- GIP: 1
- GMD: 40
- GTQ: 5
- GYD: 200
- HKD: 4
- HNL: 20
- HTG: 70
- HUF: 175
- IDR: 9,000
- ILS: 1.5
- INR: 60
- ISK: 70
- JMD: 80
- JPY: 80
- KES: 70
- KGS: 50
- KHR: 3,000
- KMF: 500
- KRW: 800
- KYD: 1
- KZT: 300
- LAK: 20,000
- LKR: 200
- LRD: 100
- LSL: 10
- MAD: 5
- MDL: 10
- MGA: 3,000
- MKD: 50
- MNT: 2,000
- MOP: 5
- MUR: 50
- MVR: 8
- MXN: 9
- MWK: 1,000
- MYR: 2
- MZN: 50
- NAD: 10
- NGN: 700
- NIO: 20
- NOK: 5
- NPR: 80
- NZD: 0.9
- PAB: 1
- PEN: 2
- PGK: 3
- PHP: 35
- PKR: 200
- PLN: 2
- PYG: 4,000
- QAR: 2
- RON: 2.5
- RSD: 60
- RWF: 1,000
- SAR: 2
- SBD: 4
- SCR: 8
- SEK: 5
- SGD: 0.7
- SHP: 1
- SOS: 500
- SRD: 20
- SZL: 10
- THB: 20
- TJS: 5
- TOP: 2
- TRY: 30
- TTD: 4
- TWD: 20
- TZS: 2,000
- UAH: 30
- UGX: 2,000
- UYU: 20
- UZS: 7,000
- VND: 20,000
- VUV: 100
- WST: 2
- XAF: 500
- XCD: 2
- XCG: 1
- XOF: 500
- XPF: 100
- YER: 200
- ZAR: 9
- ZMW: 10
- Other currencies: 50 minor units"""

    maximum_amount: typing.NotRequired[int | None]
    """The maximum amount the customer can pay. Maximum per currency:
- USD: 999,999.99
- EUR: 999,999.99
- GBP: 999,999.99
- ARS: 1,400,000
- CDF: 2,800,000
- COP: 4,000,000
- IDR: 16,000,000
- KHR: 4,000,000
- LAK: 21,000,000
- MNT: 3,500,000
- MWK: 1,750,000
- NGN: 1,550,000
- TZS: 2,500,000
- UGX: 3,700,000
- UZS: 12,500,000
- Other currencies: 99,999,999 minor units"""

    preset_amount: typing.NotRequired[int | None]
    """The initial amount shown to the customer. If 0, the customer will see $0 as the default. If set to a value below the minimum price amount for the currency, it will be rejected.Minimum per currency:
- USD: 0.5
- AED: 2
- ALL: 50
- AMD: 200
- AOA: 500
- ARS: 750
- AUD: 0.7
- AWG: 1
- AZN: 1
- BAM: 1
- BBD: 2
- BDT: 70
- BIF: 2,000
- BMD: 1
- BND: 1
- BOB: 5
- BRL: 2.5
- BSD: 1
- BWP: 10
- BZD: 2
- CAD: 0.7
- CDF: 2,000
- CHF: 0.5
- CLP: 500
- CNY: 5
- COP: 2,000
- CRC: 300
- CVE: 50
- CZK: 15
- DJF: 100
- DKK: 3.2
- DOP: 40
- DZD: 70
- EGP: 30
- ETB: 80
- EUR: 0.5
- FJD: 2
- FKP: 1
- GBP: 0.4
- GEL: 2
- GNF: 5,000
- GIP: 1
- GMD: 40
- GTQ: 5
- GYD: 200
- HKD: 4
- HNL: 20
- HTG: 70
- HUF: 175
- IDR: 9,000
- ILS: 1.5
- INR: 60
- ISK: 70
- JMD: 80
- JPY: 80
- KES: 70
- KGS: 50
- KHR: 3,000
- KMF: 500
- KRW: 800
- KYD: 1
- KZT: 300
- LAK: 20,000
- LKR: 200
- LRD: 100
- LSL: 10
- MAD: 5
- MDL: 10
- MGA: 3,000
- MKD: 50
- MNT: 2,000
- MOP: 5
- MUR: 50
- MVR: 8
- MXN: 9
- MWK: 1,000
- MYR: 2
- MZN: 50
- NAD: 10
- NGN: 700
- NIO: 20
- NOK: 5
- NPR: 80
- NZD: 0.9
- PAB: 1
- PEN: 2
- PGK: 3
- PHP: 35
- PKR: 200
- PLN: 2
- PYG: 4,000
- QAR: 2
- RON: 2.5
- RSD: 60
- RWF: 1,000
- SAR: 2
- SBD: 4
- SCR: 8
- SEK: 5
- SGD: 0.7
- SHP: 1
- SOS: 500
- SRD: 20
- SZL: 10
- THB: 20
- TJS: 5
- TOP: 2
- TRY: 30
- TTD: 4
- TWD: 20
- TZS: 2,000
- UAH: 30
- UGX: 2,000
- UYU: 20
- UZS: 7,000
- VND: 20,000
- VUV: 100
- WST: 2
- XAF: 500
- XCD: 2
- XCG: 1
- XOF: 500
- XPF: 100
- YER: 200
- ZAR: 9
- ZMW: 10
- Other currencies: 50 minor units"""


class ProductPriceFixedCreate(typing.TypedDict):
    """Schema to create a fixed price."""

    amount_type: typing.Literal["fixed"]

    price_currency: typing.NotRequired[PresentmentCurrency]

    tax_behavior: typing.NotRequired[TaxBehaviorOption | None]
    """The tax behavior of the price. If not set, it will default to the organization's default tax behavior."""

    price_amount: int
    """The price in cents. Set to `0` for a free price.
Minimum amounts per currency:
- USD: 0.5
- AED: 2
- ALL: 50
- AMD: 200
- AOA: 500
- ARS: 750
- AUD: 0.7
- AWG: 1
- AZN: 1
- BAM: 1
- BBD: 2
- BDT: 70
- BIF: 2,000
- BMD: 1
- BND: 1
- BOB: 5
- BRL: 2.5
- BSD: 1
- BWP: 10
- BZD: 2
- CAD: 0.7
- CDF: 2,000
- CHF: 0.5
- CLP: 500
- CNY: 5
- COP: 2,000
- CRC: 300
- CVE: 50
- CZK: 15
- DJF: 100
- DKK: 3.2
- DOP: 40
- DZD: 70
- EGP: 30
- ETB: 80
- EUR: 0.5
- FJD: 2
- FKP: 1
- GBP: 0.4
- GEL: 2
- GNF: 5,000
- GIP: 1
- GMD: 40
- GTQ: 5
- GYD: 200
- HKD: 4
- HNL: 20
- HTG: 70
- HUF: 175
- IDR: 9,000
- ILS: 1.5
- INR: 60
- ISK: 70
- JMD: 80
- JPY: 80
- KES: 70
- KGS: 50
- KHR: 3,000
- KMF: 500
- KRW: 800
- KYD: 1
- KZT: 300
- LAK: 20,000
- LKR: 200
- LRD: 100
- LSL: 10
- MAD: 5
- MDL: 10
- MGA: 3,000
- MKD: 50
- MNT: 2,000
- MOP: 5
- MUR: 50
- MVR: 8
- MXN: 9
- MWK: 1,000
- MYR: 2
- MZN: 50
- NAD: 10
- NGN: 700
- NIO: 20
- NOK: 5
- NPR: 80
- NZD: 0.9
- PAB: 1
- PEN: 2
- PGK: 3
- PHP: 35
- PKR: 200
- PLN: 2
- PYG: 4,000
- QAR: 2
- RON: 2.5
- RSD: 60
- RWF: 1,000
- SAR: 2
- SBD: 4
- SCR: 8
- SEK: 5
- SGD: 0.7
- SHP: 1
- SOS: 500
- SRD: 20
- SZL: 10
- THB: 20
- TJS: 5
- TOP: 2
- TRY: 30
- TTD: 4
- TWD: 20
- TZS: 2,000
- UAH: 30
- UGX: 2,000
- UYU: 20
- UZS: 7,000
- VND: 20,000
- VUV: 100
- WST: 2
- XAF: 500
- XCD: 2
- XCG: 1
- XOF: 500
- XPF: 100
- YER: 200
- ZAR: 9
- ZMW: 10
- Other currencies: 50 minor units"""


class ProductPriceMeteredUnitCreate(typing.TypedDict):
    """Schema to create a metered price with a fixed unit price."""

    amount_type: typing.Literal["metered_unit"]

    price_currency: typing.NotRequired[PresentmentCurrency]

    tax_behavior: typing.NotRequired[TaxBehaviorOption | None]
    """The tax behavior of the price. If not set, it will default to the organization's default tax behavior."""

    meter_id: str
    """The ID of the meter associated to the price."""

    unit_amount: float | str
    """The price per unit in cents. Supports up to 12 decimal places."""

    cap_amount: typing.NotRequired[int | None]
    """Optional maximum amount in cents that can be charged, regardless of the number of units consumed."""


class ProductPriceSeatBasedCreate(typing.TypedDict):
    """Schema to create a seat-based price with volume-based tiers."""

    amount_type: typing.Literal["seat_based"]

    price_currency: typing.NotRequired[PresentmentCurrency]

    tax_behavior: typing.NotRequired[TaxBehaviorOption | None]
    """The tax behavior of the price. If not set, it will default to the organization's default tax behavior."""

    seat_tiers: ProductPriceSeatTiersInput


class ProductPriceSeatTier(typing.TypedDict):
    """A pricing tier for seat-based pricing."""

    min_seats: int
    """Minimum number of seats (inclusive)"""

    max_seats: typing.NotRequired[int | None]
    """Maximum number of seats (inclusive). None for unlimited."""

    price_per_seat: int
    """Price per seat in cents for this tier"""


class ProductPriceSeatTiersInput(typing.TypedDict):
    """List of pricing tiers for seat-based pricing.

    The minimum and maximum seat limits are derived from the tiers:
    - minimum_seats = first tier's min_seats
    - maximum_seats = last tier's max_seats (None for unlimited)"""

    seat_tier_type: typing.NotRequired[SeatTierType]

    tiers: list[ProductPriceSeatTier]
    """List of pricing tiers"""


class ProductUpdate(typing.TypedDict):
    """Schema to update a product."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    trial_interval: typing.NotRequired[TrialInterval | None]
    """The interval unit for the trial period."""

    trial_interval_count: typing.NotRequired[int | None]
    """The number of interval units for the trial period."""

    name: typing.NotRequired[str | None]

    description: typing.NotRequired[str | None]
    """The description of the product."""

    recurring_interval: typing.NotRequired[RecurringInterval | None]
    """The recurring interval of the product. If `None`, the product is a one-time purchase. **Can only be set on legacy recurring products. Once set, it can't be changed.**"""

    recurring_interval_count: typing.NotRequired[int | None]
    """Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. Once set, it can't be changed.**"""

    is_archived: typing.NotRequired[bool | None]
    """Whether the product is archived. If `true`, the product won't be available for purchase anymore. Existing customers will still have access to their benefits, and subscriptions will continue normally."""

    visibility: typing.NotRequired[ProductVisibility | None]
    """The visibility of the product."""

    prices: typing.NotRequired[
        list[
            ExistingProductPrice
            | ProductPriceFixedCreate
            | ProductPriceCustomCreate
            | ProductPriceSeatBasedCreate
            | ProductPriceMeteredUnitCreate
        ]
        | None
    ]
    """List of available prices for this product. If you want to keep existing prices, include them in the list as an `ExistingProductPrice` object."""

    medias: typing.NotRequired[list[str] | None]
    """List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded."""

    attached_custom_fields: typing.NotRequired[
        list[AttachedCustomFieldCreate] | None
    ]


class PropertyAggregation(typing.TypedDict):
    func: Func

    property: str


class RefundCreate(typing.TypedDict):
    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    order_id: str

    reason: Reason
    """Reason for the refund."""

    amount: int
    """Amount to refund in cents. Minimum is 1."""

    comment: typing.NotRequired[str | None]
    """An internal comment about the refund."""

    revoke_benefits: typing.NotRequired[bool]
    """Should this refund trigger the associated customer benefits to be revoked?

**Note:**
Only allowed in case the `order` is a one-time purchase.
Subscriptions automatically revoke customer benefits once the
subscription itself is revoked, i.e fully canceled."""


class S3FileCreateMultipart(typing.TypedDict):
    parts: list[S3FileCreatePart]


class S3FileCreatePart(typing.TypedDict):
    number: int

    chunk_start: int

    chunk_end: int

    checksum_sha256_base64: typing.NotRequired[str | None]


class S3FileUploadCompletedPart(typing.TypedDict):
    number: int

    checksum_etag: str

    checksum_sha256_base64: str | None


class SeatAssign(typing.TypedDict):
    subscription_id: typing.NotRequired[str | None]
    """Subscription ID. Required if neither order_id nor checkout_id is provided."""

    order_id: typing.NotRequired[str | None]
    """Order ID for one-time purchases. Required if subscription_id is not provided."""

    email: typing.NotRequired[str | None]
    """Email of the customer to assign the seat to"""

    external_customer_id: typing.NotRequired[str | None]
    """External customer ID for the seat assignment"""

    customer_id: typing.NotRequired[str | None]
    """Customer ID for the seat assignment"""

    external_member_id: typing.NotRequired[str | None]
    """External member ID for the seat assignment. Can be used alone (lookup existing member) or with email (create/validate member)."""

    member_id: typing.NotRequired[str | None]
    """Member ID for the seat assignment."""

    metadata: typing.NotRequired[dict[str, typing.Any] | None]
    """Additional metadata for the seat (max 10 keys, 1KB total)"""

    immediate_claim: typing.NotRequired[bool]
    """If true, the seat will be immediately claimed without sending an invitation email. API-only feature."""


class SeatClaim(typing.TypedDict):
    invitation_token: str
    """Invitation token to claim the seat"""


class SubscriptionCancel(typing.TypedDict):
    customer_cancellation_reason: typing.NotRequired[CustomerCancellationReason | None]
    """Customer reason for cancellation.

Helpful to monitor reasons behind churn for future improvements.

Only set this in case your own service is requesting the reason from the
customer. Or you know based on direct conversations, i.e support, with
the customer.

* `too_expensive`: Too expensive for the customer.
* `missing_features`: Customer is missing certain features.
* `switched_service`: Customer switched to another service.
* `unused`: Customer is not using it enough.
* `customer_service`: Customer is not satisfied with the customer service.
* `low_quality`: Customer is unhappy with the quality.
* `too_complex`: Customer considers the service too complicated.
* `other`: Other reason(s)."""

    customer_cancellation_comment: typing.NotRequired[str | None]
    """Customer feedback and why they decided to cancel.

**IMPORTANT:**
Do not use this to store internal notes! It's intended to be input
from the customer and is therefore also available in their Polar
purchases library.

Only set this in case your own service is requesting the reason from the
customer. Or you copy a message directly from a customer
conversation, i.e support."""

    cancel_at_period_end: bool
    """Cancel an active subscription once the current period ends.

Or uncancel a subscription currently set to be revoked at period end."""


class SubscriptionCreateCustomer(typing.TypedDict):
    """Create a subscription for an existing customer."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    product_id: str
    """The ID of the recurring product to subscribe to. Must be a free product, otherwise the customer should go through a checkout flow."""

    customer_id: str
    """The ID of the customer to create the subscription for."""


class SubscriptionCreateExternalCustomer(typing.TypedDict):
    """Create a subscription for an existing customer identified by an external ID."""

    metadata: typing.NotRequired[dict[str, str | int | float | bool]]
    """Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**."""

    product_id: str
    """The ID of the recurring product to subscribe to. Must be a free product, otherwise the customer should go through a checkout flow."""

    external_customer_id: str
    """The ID of the customer in your system to create the subscription for. It must already exist in Polar."""


class SubscriptionRevoke(typing.TypedDict):
    customer_cancellation_reason: typing.NotRequired[CustomerCancellationReason | None]
    """Customer reason for cancellation.

Helpful to monitor reasons behind churn for future improvements.

Only set this in case your own service is requesting the reason from the
customer. Or you know based on direct conversations, i.e support, with
the customer.

* `too_expensive`: Too expensive for the customer.
* `missing_features`: Customer is missing certain features.
* `switched_service`: Customer switched to another service.
* `unused`: Customer is not using it enough.
* `customer_service`: Customer is not satisfied with the customer service.
* `low_quality`: Customer is unhappy with the quality.
* `too_complex`: Customer considers the service too complicated.
* `other`: Other reason(s)."""

    customer_cancellation_comment: typing.NotRequired[str | None]
    """Customer feedback and why they decided to cancel.

**IMPORTANT:**
Do not use this to store internal notes! It's intended to be input
from the customer and is therefore also available in their Polar
purchases library.

Only set this in case your own service is requesting the reason from the
customer. Or you copy a message directly from a customer
conversation, i.e support."""

    revoke: typing.Literal[True]
    """Cancel and revoke an active subscription immediately"""


class SubscriptionUpdateBase(typing.TypedDict):
    product_id: typing.NotRequired[str | None]
    """Update subscription to another product."""

    proration_behavior: typing.NotRequired[SubscriptionProrationBehavior | None]
    """Determine how to handle the proration billing. If not provided, will use the default organization setting."""

    discount_id: typing.NotRequired[str | None]
    """Update the subscription to apply a new discount. If set to `null`, the discount will be removed. The change will be applied on the next billing cycle."""

    trial_end: typing.NotRequired[str | typing.Literal["now"] | None]
    """Set or extend the trial period of the subscription. If set to `now`, the trial will end immediately."""


class SubscriptionUpdateBillingPeriod(typing.TypedDict):
    current_billing_period_end: str
    """Set a new date for the end of the current billing period. The subscription will renew on this date. The new date can be earlier or later than the current period end, as long as it's in the future.

It is not possible to update the current billing period on a canceled subscription."""


class SubscriptionUpdateClear(typing.TypedDict):
    pending_update: None
    """Clear the pending subscription update. Set to null to remove scheduled changes."""


class SubscriptionUpdateSeats(typing.TypedDict):
    seats: int
    """Update the number of seats for this subscription."""

    proration_behavior: typing.NotRequired[SubscriptionProrationBehavior | None]
    """Determine how to handle the proration billing. If not provided, will use the default organization setting."""


class SupportCaseAttachmentFileCreate(typing.TypedDict):
    """Schema to create a file attached to a support case."""

    organization_id: typing.NotRequired[str | None]

    name: str

    mime_type: str
    """MIME type of the file. Images, videos, PDF, CSV, plain text, Word and Excel documents are supported."""

    size: int
    """Size of the file. A maximum of 250 MB is allowed for this type of file."""

    checksum_sha256_base64: typing.NotRequired[str | None]

    upload: S3FileCreateMultipart

    service: typing.Literal["support_case_attachment"]

    version: typing.NotRequired[str | None]


class UniqueAggregation(typing.TypedDict):
    func: typing.NotRequired[typing.Literal["unique"]]

    property: str


class WebhookEndpointCreate(typing.TypedDict):
    """Schema to create a webhook endpoint."""

    url: str
    """The URL where the webhook events will be sent."""

    name: typing.NotRequired[str | None]
    """An optional name for the webhook endpoint to help organize and identify it."""

    format: WebhookFormat

    events: list[WebhookEventType]
    """The events that will trigger the webhook."""

    organization_id: typing.NotRequired[str | None]
    """The organization ID associated with the webhook endpoint. **Required unless you use an organization token.**"""


class WebhookEndpointUpdate(typing.TypedDict):
    """Schema to update a webhook endpoint."""

    url: typing.NotRequired[str | None]

    name: typing.NotRequired[str | None]
    """An optional name for the webhook endpoint to help organize and identify it."""

    format: typing.NotRequired[WebhookFormat | None]

    events: typing.NotRequired[list[WebhookEventType] | None]

    enabled: typing.NotRequired[bool | None]
    """Whether the webhook endpoint is enabled."""


BenefitCreate: typing.TypeAlias = (
    BenefitCustomCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
    | BenefitDownloadablesCreate
    | BenefitLicenseKeysCreate
    | BenefitMeterCreditCreate
    | BenefitFeatureFlagCreate
    | BenefitSlackSharedChannelCreate
)

CheckoutLinkCreate: typing.TypeAlias = (
    CheckoutLinkCreateProductPrice
    | CheckoutLinkCreateProduct
    | CheckoutLinkCreateProducts
)

CustomFieldCreate: typing.TypeAlias = (
    CustomFieldCreateText
    | CustomFieldCreateNumber
    | CustomFieldCreateDate
    | CustomFieldCreateCheckbox
    | CustomFieldCreateSelect
)

CustomFieldUpdate: typing.TypeAlias = (
    CustomFieldUpdateText
    | CustomFieldUpdateNumber
    | CustomFieldUpdateDate
    | CustomFieldUpdateCheckbox
    | CustomFieldUpdateSelect
)

CustomerBenefitGrantUpdate: typing.TypeAlias = (
    CustomerBenefitGrantDiscordUpdate
    | CustomerBenefitGrantGitHubRepositoryUpdate
    | CustomerBenefitGrantDownloadablesUpdate
    | CustomerBenefitGrantLicenseKeysUpdate
    | CustomerBenefitGrantCustomUpdate
    | CustomerBenefitGrantMeterCreditUpdate
    | CustomerBenefitGrantFeatureFlagUpdate
    | CustomerBenefitGrantSlackSharedChannelUpdate
)

CustomerCreate: typing.TypeAlias = CustomerIndividualCreate | CustomerTeamCreate

CustomerSubscriptionUpdate: typing.TypeAlias = (
    CustomerSubscriptionUpdateProduct
    | CustomerSubscriptionUpdateSeats
    | CustomerSubscriptionCancel
    | CustomerSubscriptionUpdateClear
)

DiscountCreate: typing.TypeAlias = DiscountFixedCreate | DiscountPercentageCreate

FileCreate: typing.TypeAlias = (
    DownloadableFileCreate
    | ProductMediaFileCreate
    | OrganizationAvatarFileCreate
    | SupportCaseAttachmentFileCreate
)

MetadataQuery: typing.TypeAlias = (
    dict[
        str, str | int | bool | list[str] | list[int] | list[bool]
    ]
    | None
)

ProductCreate: typing.TypeAlias = ProductCreateRecurring | ProductCreateOneTime

SubscriptionUpdate: typing.TypeAlias = (
    SubscriptionUpdateBase
    | SubscriptionUpdateSeats
    | SubscriptionUpdateBillingPeriod
    | SubscriptionCancel
    | SubscriptionRevoke
    | SubscriptionUpdateClear
)
