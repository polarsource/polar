import type {
  SubscriptionProrationBehavior,
  BenefitVisibility,
  ProductVisibility,
  Timeframe,
  MeterUnit,
  SeatTierType,
  DiscountDuration,
  OrganizationSocialPlatforms,
  RefundReason,
  Permission,
  PresentmentCurrency,
  CountryAlpha2Input,
  TrialInterval,
  SubType,
  PublicSubscriptionProrationBehavior,
  WebhookFormat,
  TaxBehaviorOption,
  WebhookEventType,
  CustomerCancellationReason,
  CustomerType,
  TokenEndpointAuthMethod,
  LicenseKeyStatus,
  Func,
  PaymentProcessor,
  SubscriptionRecurringInterval,
  MemberRole,
  Role,
  FilterOperator,
  DiscountType,
  FilterConjunction,
} from "./literals";
/**
 * AddressInput
 */
export interface AddressInput {
  /**
   * line1
   */
  line1?: string | null;
  /**
   * line2
   */
  line2?: string | null;
  /**
   * postal_code
   */
  postal_code?: string | null;
  /**
   * city
   */
  city?: string | null;
  /**
   * state
   */
  state?: string | null;
  /**
   * country
   */
  country: CountryAlpha2Input;
} /**
 * Schema to attach a custom field to a resource.
 */
export interface AttachedCustomFieldCreate {
  /**
   * ID of the custom field to attach.
   */
  custom_field_id: string;
  /**
   * Whether the value is required for this custom field.
   */
  required: boolean;
} /**
 * Schema to create a benefit of type `custom`.
 */
export interface BenefitCustomCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "custom";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitCustomCreateProperties;
} /**
 * Properties for creating a benefit of type `custom`.
 */
export interface BenefitCustomCreateProperties {
  /**
   * note
   */
  note?: (string | null) | null;
} /**
 * Properties for a benefit of type `custom`.
 */
export interface BenefitCustomProperties {
  /**
   * note
   */
  note: (string | null) | null;
} /**
 * BenefitCustomUpdate
 */
export interface BenefitCustomUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * type
   */
  type: "custom";
  /**
   * properties
   */
  properties?: BenefitCustomProperties | null;
} /**
 * BenefitDiscordCreate
 */
export interface BenefitDiscordCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "discord";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitDiscordCreateProperties;
} /**
 * Properties to create a benefit of type `discord`.
 */
export interface BenefitDiscordCreateProperties {
  /**
   * guild_token
   */
  guild_token: string;
  /**
   * The ID of the Discord role to grant.
   */
  role_id: string;
  /**
   * Whether to kick the member from the Discord server on revocation.
   */
  kick_member: boolean;
} /**
 * BenefitDiscordUpdate
 */
export interface BenefitDiscordUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * type
   */
  type: "discord";
  /**
   * properties
   */
  properties?: BenefitDiscordCreateProperties | null;
} /**
 * BenefitDownloadablesCreate
 */
export interface BenefitDownloadablesCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "downloadables";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitDownloadablesCreateProperties;
} /**
 * BenefitDownloadablesCreateProperties
 */
export interface BenefitDownloadablesCreateProperties {
  /**
   * archived
   */
  archived?: Record<string, boolean>;
  /**
   * files
   */
  files: string[];
} /**
 * BenefitDownloadablesUpdate
 */
export interface BenefitDownloadablesUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * type
   */
  type: "downloadables";
  /**
   * properties
   */
  properties?: BenefitDownloadablesCreateProperties | null;
} /**
 * Schema to create a benefit of type `feature_flag`.
 */
export interface BenefitFeatureFlagCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "feature_flag";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitFeatureFlagCreateProperties;
} /**
 * Properties for creating a benefit of type `feature_flag`.
 */
export interface BenefitFeatureFlagCreateProperties extends Record<string, never> {} /**
 * Properties for a benefit of type `feature_flag`.
 */
export interface BenefitFeatureFlagProperties extends Record<string, never> {} /**
 * BenefitFeatureFlagUpdate
 */
export interface BenefitFeatureFlagUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * type
   */
  type: "feature_flag";
  /**
   * properties
   */
  properties?: BenefitFeatureFlagProperties | null;
} /**
 * BenefitGitHubRepositoryCreate
 */
export interface BenefitGitHubRepositoryCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "github_repository";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitGitHubRepositoryCreateProperties;
} /**
 * Properties to create a benefit of type `github_repository`.
 */
export interface BenefitGitHubRepositoryCreateProperties {
  /**
   * The owner of the repository.
   */
  repository_owner: string;
  /**
   * The name of the repository.
   */
  repository_name: string;
  /**
   * The permission level to grant. Read more about roles and their permissions on [GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role).
   */
  permission: Permission;
} /**
 * BenefitGitHubRepositoryUpdate
 */
export interface BenefitGitHubRepositoryUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * type
   */
  type: "github_repository";
  /**
   * properties
   */
  properties?: BenefitGitHubRepositoryCreateProperties | null;
} /**
 * BenefitLicenseKeyActivationCreateProperties
 */
export interface BenefitLicenseKeyActivationCreateProperties {
  /**
   * limit
   */
  limit: number;
  /**
   * enable_customer_admin
   */
  enable_customer_admin: boolean;
} /**
 * BenefitLicenseKeyExpirationProperties
 */
export interface BenefitLicenseKeyExpirationProperties {
  /**
   * ttl
   */
  ttl: number;
  /**
   * timeframe
   */
  timeframe: Timeframe;
} /**
 * BenefitLicenseKeysCreate
 */
export interface BenefitLicenseKeysCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "license_keys";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitLicenseKeysCreateProperties;
} /**
 * BenefitLicenseKeysCreateProperties
 */
export interface BenefitLicenseKeysCreateProperties {
  /**
   * prefix
   */
  prefix?: string | null;
  /**
   * expires
   */
  expires?: BenefitLicenseKeyExpirationProperties | null;
  /**
   * activations
   */
  activations?: BenefitLicenseKeyActivationCreateProperties | null;
  /**
   * limit_usage
   */
  limit_usage?: number | null;
} /**
 * BenefitLicenseKeysUpdate
 */
export interface BenefitLicenseKeysUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * type
   */
  type: "license_keys";
  /**
   * properties
   */
  properties?: BenefitLicenseKeysCreateProperties | null;
} /**
 * Schema to create a benefit of type `meter_unit`.
 */
export interface BenefitMeterCreditCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "meter_credit";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitMeterCreditCreateProperties;
} /**
 * Properties for creating a benefit of type `meter_unit`.
 */
export interface BenefitMeterCreditCreateProperties {
  /**
   * units
   */
  units: number;
  /**
   * rollover
   */
  rollover: boolean;
  /**
   * meter_id
   */
  meter_id: string;
} /**
 * BenefitMeterCreditUpdate
 */
export interface BenefitMeterCreditUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * type
   */
  type: "meter_credit";
  /**
   * properties
   */
  properties?: BenefitMeterCreditCreateProperties | null;
} /**
 * BenefitSlackSharedChannelCreate
 */
export interface BenefitSlackSharedChannelCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "slack_shared_channel";
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description: string;
  /**
   * The ID of the organization owning the benefit. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The visibility of the benefit in the customer portal.
   */
  visibility?: BenefitVisibility | null;
  /**
   * properties
   */
  properties: BenefitSlackSharedChannelCreateProperties;
} /**
 * BenefitSlackSharedChannelCreateProperties
 */
export interface BenefitSlackSharedChannelCreateProperties {
  /**
   * Polar Slack integration to use for this benefit.
   */
  slack_integration_id: string;
  /**
   * channel_name_template
   */
  channel_name_template: string;
  /**
   * private
   */
  private?: boolean;
  /**
   * welcome_message
   */
  welcome_message?: string | null;
  /**
   * archive_on_revoke
   */
  archive_on_revoke?: boolean;
  /**
   * team_invitees
   */
  team_invitees?: string[];
} /**
 * BenefitSlackSharedChannelUpdate
 */
export interface BenefitSlackSharedChannelUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The description of the benefit. Will be displayed on products having this benefit.
   */
  description?: string | null;
  /**
   * type
   */
  type: "slack_shared_channel";
  /**
   * properties
   */
  properties?: BenefitSlackSharedChannelCreateProperties | null;
} /**
 * Confirm a checkout session using a Stripe confirmation token.
 */
export interface CheckoutConfirmStripe {
  /**
   * Key-value object storing custom field values.
   */
  custom_field_data?: Record<string, string | number | boolean | string | null>;
  /**
   * ID of the product to checkout. Must be present in the checkout's product list.
   */
  product_id?: string | null;
  /**
   * ID of the product price to checkout. Must correspond to a price present in the checkout's product list.
   */
  product_price_id?: string | null;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * Number of seats for seat-based pricing.
   */
  seats?: number | null;
  /**
   * is_business_customer
   */
  is_business_customer?: boolean | null;
  /**
   * customer_name
   */
  customer_name?: string | null;
  /**
   * customer_email
   */
  customer_email?: string | null;
  /**
   * customer_billing_name
   */
  customer_billing_name?: string | null;
  /**
   * customer_billing_address
   */
  customer_billing_address?: AddressInput | null;
  /**
   * customer_tax_id
   */
  customer_tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * Discount code to apply to the checkout.
   */
  discount_code?: string | null;
  /**
   * Disable the trial period for the checkout session. It's mainly useful when the trial is blocked because the customer already redeemed one.
   */
  allow_trial?: false | null;
  /**
   * ID of the Stripe confirmation token. Required for fixed prices and custom prices.
   */
  confirmation_token_id?: string | null;
} /**
 * Create a new checkout session from a list of products.
Customers will be able to switch between those products.

Metadata set on the checkout will be copied
to the resulting order and/or subscription.
 */
export interface CheckoutCreate {
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * Key-value object storing custom field values.
   */
  custom_field_data?: Record<string, string | number | boolean | string | null>;
  /**
   * ID of the discount to apply to the checkout.
   */
  discount_id?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`.
   */
  require_billing_address?: boolean;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * Predefined number of seats (works with seat-based pricing only)
   */
  seats?: number | null;
  /**
   * Minimum number of seats (works with seat-based pricing only)
   */
  min_seats?: number | null;
  /**
   * Maximum number of seats (works with seat-based pricing only)
   */
  max_seats?: number | null;
  /**
   * Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured.
   */
  allow_trial?: boolean;
  /**
   * ID of an existing customer in the organization. The customer data will be pre-filled in the checkout form. The resulting order will be linked to this customer.
   */
  customer_id?: string | null;
  /**
   * Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name.
   */
  is_business_customer?: boolean;
  /**
   * ID of the customer in your system. If a matching customer exists on Polar, the resulting order will be linked to this customer. Otherwise, a new customer will be created with this external ID set.
   */
  external_customer_id?: string | null;
  /**
   * customer_name
   */
  customer_name?: string | null;
  /**
   * customer_email
   */
  customer_email?: string | null;
  /**
   * customer_ip_address
   */
  customer_ip_address?: string | null;
  /**
   * customer_billing_name
   */
  customer_billing_name?: string | null;
  /**
   * customer_billing_address
   */
  customer_billing_address?: AddressInput | null;
  /**
   * customer_tax_id
   */
  customer_tax_id?: string | null;
  /**
   * Key-value object allowing you to store additional information that'll be copied to the created customer.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  customer_metadata?: Record<string, string | number | number | boolean>;
  /**
   * ID of a subscription to upgrade. It must be on a free pricing. If checkout is successful, metadata set on this checkout will be copied to the subscription, and existing keys will be overwritten.
   */
  subscription_id?: string | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
  /**
   * If you plan to embed the checkout session, set this to the Origin of the embedding page. It'll allow the Polar iframe to communicate with the parent page.
   */
  embed_origin?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * currency
   */
  currency?: PresentmentCurrency | null;
  /**
   * List of product IDs available to select at that checkout. The first one will be selected by default.
   */
  products: string[];
  /**
   * Optional mapping of product IDs to a list of ad-hoc prices to create for that product. If not set, catalog prices of the product will be used.
   */
  prices?: Record<
    string,
    | ProductPriceFixedCreate
    | ProductPriceCustomCreate
    | ProductPriceSeatBasedCreate
    | ProductPriceMeteredUnitCreate[]
  > | null;
} /**
 * Schema to create a new checkout link from a a single product.

**Deprecated**: Use `CheckoutLinkCreateProducts` instead.
 */
export interface CheckoutLinkCreateProduct {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Payment processor to use. Currently only Stripe is supported.
   */
  payment_processor: "stripe";
  /**
   * Optional label to distinguish links internally
   */
  label?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting.
   */
  require_billing_address?: boolean;
  /**
   * ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored.
   */
  discount_id?: string | null;
  /**
   * Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored.
   */
  seats?: number | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
  /**
   * product_id
   */
  product_id: string;
} /**
 * Schema to create a new checkout link from a a single product price.

**Deprecated**: Use `CheckoutLinkCreateProducts` instead.
 */
export interface CheckoutLinkCreateProductPrice {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Payment processor to use. Currently only Stripe is supported.
   */
  payment_processor: "stripe";
  /**
   * Optional label to distinguish links internally
   */
  label?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting.
   */
  require_billing_address?: boolean;
  /**
   * ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored.
   */
  discount_id?: string | null;
  /**
   * Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored.
   */
  seats?: number | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
  /**
   * product_price_id
   */
  product_price_id: string;
} /**
 * Schema to create a new checkout link.
 */
export interface CheckoutLinkCreateProducts {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Payment processor to use. Currently only Stripe is supported.
   */
  payment_processor: "stripe";
  /**
   * Optional label to distinguish links internally
   */
  label?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting.
   */
  require_billing_address?: boolean;
  /**
   * ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored.
   */
  discount_id?: string | null;
  /**
   * Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored.
   */
  seats?: number | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
  /**
   * List of products that will be available to select at checkout.
   */
  products: string[];
} /**
 * Schema to update an existing checkout link.
 */
export interface CheckoutLinkUpdate {
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * List of products that will be available to select at checkout.
   */
  products?: string[] | null;
  /**
   * label
   */
  label?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean | null;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting.
   */
  require_billing_address?: boolean | null;
  /**
   * ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored.
   */
  discount_id?: string | null;
  /**
   * Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored.
   */
  seats?: number | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
} /**
 * Update an existing checkout session using an access token.
 */
export interface CheckoutUpdate {
  /**
   * Key-value object storing custom field values.
   */
  custom_field_data?: Record<string, string | number | boolean | string | null>;
  /**
   * ID of the product to checkout. Must be present in the checkout's product list.
   */
  product_id?: string | null;
  /**
   * ID of the product price to checkout. Must correspond to a price present in the checkout's product list.
   */
  product_price_id?: string | null;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * Number of seats for seat-based pricing.
   */
  seats?: number | null;
  /**
   * is_business_customer
   */
  is_business_customer?: boolean | null;
  /**
   * customer_name
   */
  customer_name?: string | null;
  /**
   * customer_email
   */
  customer_email?: string | null;
  /**
   * customer_billing_name
   */
  customer_billing_name?: string | null;
  /**
   * customer_billing_address
   */
  customer_billing_address?: AddressInput | null;
  /**
   * customer_tax_id
   */
  customer_tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * currency
   */
  currency?: PresentmentCurrency | null;
  /**
   * ID of the discount to apply to the checkout.
   */
  discount_id?: string | null;
  /**
   * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
   */
  allow_discount_codes?: boolean | null;
  /**
   * Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`.
   */
  require_billing_address?: boolean | null;
  /**
   * Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured.
   */
  allow_trial?: boolean | null;
  /**
   * customer_ip_address
   */
  customer_ip_address?: string | null;
  /**
   * Key-value object allowing you to store additional information that'll be copied to the created customer.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  customer_metadata?: Record<string, string | number | number | boolean> | null;
  /**
   * URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.
   */
  success_url?: string | null;
  /**
   * When set, a back button will be shown in the checkout to return to this URL.
   */
  return_url?: string | null;
  /**
   * If you plan to embed the checkout session, set this to the Origin of the embedding page. It'll allow the Polar iframe to communicate with the parent page.
   */
  embed_origin?: string | null;
} /**
 * Update an existing checkout session using the client secret.
 */
export interface CheckoutUpdatePublic {
  /**
   * Key-value object storing custom field values.
   */
  custom_field_data?: Record<string, string | number | boolean | string | null>;
  /**
   * ID of the product to checkout. Must be present in the checkout's product list.
   */
  product_id?: string | null;
  /**
   * ID of the product price to checkout. Must correspond to a price present in the checkout's product list.
   */
  product_price_id?: string | null;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * Number of seats for seat-based pricing.
   */
  seats?: number | null;
  /**
   * is_business_customer
   */
  is_business_customer?: boolean | null;
  /**
   * customer_name
   */
  customer_name?: string | null;
  /**
   * customer_email
   */
  customer_email?: string | null;
  /**
   * customer_billing_name
   */
  customer_billing_name?: string | null;
  /**
   * customer_billing_address
   */
  customer_billing_address?: AddressInput | null;
  /**
   * customer_tax_id
   */
  customer_tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * Discount code to apply to the checkout.
   */
  discount_code?: string | null;
  /**
   * Disable the trial period for the checkout session. It's mainly useful when the trial is blocked because the customer already redeemed one.
   */
  allow_trial?: false | null;
} /**
 * CostMetadataInput
 */
export interface CostMetadataInput {
  /**
   * The amount in cents.
   */
  amount: number | string;
  /**
   * The currency. Currently, only `usd` is supported.
   */
  currency: string;
} /**
 * CountAggregation
 */
export interface CountAggregation {
  /**
   * func
   */
  func?: "count";
} /**
 * CustomFieldCheckboxProperties
 */
export interface CustomFieldCheckboxProperties {
  /**
   * form_label
   */
  form_label?: string;
  /**
   * form_help_text
   */
  form_help_text?: string;
  /**
   * form_placeholder
   */
  form_placeholder?: string;
} /**
 * Schema to create a custom field of type checkbox.
 */
export interface CustomFieldCreateCheckbox {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "checkbox";
  /**
   * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
   */
  slug: string;
  /**
   * Name of the custom field.
   */
  name: string;
  /**
   * The ID of the organization owning the custom field. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * properties
   */
  properties: CustomFieldCheckboxProperties;
} /**
 * Schema to create a custom field of type date.
 */
export interface CustomFieldCreateDate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "date";
  /**
   * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
   */
  slug: string;
  /**
   * Name of the custom field.
   */
  name: string;
  /**
   * The ID of the organization owning the custom field. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * properties
   */
  properties: CustomFieldDateProperties;
} /**
 * Schema to create a custom field of type number.
 */
export interface CustomFieldCreateNumber {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "number";
  /**
   * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
   */
  slug: string;
  /**
   * Name of the custom field.
   */
  name: string;
  /**
   * The ID of the organization owning the custom field. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * properties
   */
  properties: CustomFieldNumberProperties;
} /**
 * Schema to create a custom field of type select.
 */
export interface CustomFieldCreateSelect {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "select";
  /**
   * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
   */
  slug: string;
  /**
   * Name of the custom field.
   */
  name: string;
  /**
   * The ID of the organization owning the custom field. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * properties
   */
  properties: CustomFieldSelectProperties;
} /**
 * Schema to create a custom field of type text.
 */
export interface CustomFieldCreateText {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * type
   */
  type: "text";
  /**
   * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
   */
  slug: string;
  /**
   * Name of the custom field.
   */
  name: string;
  /**
   * The ID of the organization owning the custom field. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * properties
   */
  properties: CustomFieldTextProperties;
} /**
 * CustomFieldDateProperties
 */
export interface CustomFieldDateProperties {
  /**
   * form_label
   */
  form_label?: string;
  /**
   * form_help_text
   */
  form_help_text?: string;
  /**
   * form_placeholder
   */
  form_placeholder?: string;
  /**
   * ge
   */
  ge?: number;
  /**
   * le
   */
  le?: number;
} /**
 * CustomFieldNumberProperties
 */
export interface CustomFieldNumberProperties {
  /**
   * form_label
   */
  form_label?: string;
  /**
   * form_help_text
   */
  form_help_text?: string;
  /**
   * form_placeholder
   */
  form_placeholder?: string;
  /**
   * ge
   */
  ge?: number;
  /**
   * le
   */
  le?: number;
} /**
 * CustomFieldSelectOption
 */
export interface CustomFieldSelectOption {
  /**
   * value
   */
  value: string;
  /**
   * label
   */
  label: string;
} /**
 * CustomFieldSelectProperties
 */
export interface CustomFieldSelectProperties {
  /**
   * form_label
   */
  form_label?: string;
  /**
   * form_help_text
   */
  form_help_text?: string;
  /**
   * form_placeholder
   */
  form_placeholder?: string;
  /**
   * options
   */
  options: CustomFieldSelectOption[];
} /**
 * CustomFieldTextProperties
 */
export interface CustomFieldTextProperties {
  /**
   * form_label
   */
  form_label?: string;
  /**
   * form_help_text
   */
  form_help_text?: string;
  /**
   * form_placeholder
   */
  form_placeholder?: string;
  /**
   * textarea
   */
  textarea?: boolean;
  /**
   * min_length
   */
  min_length?: number;
  /**
   * max_length
   */
  max_length?: number;
} /**
 * Schema to update a custom field of type checkbox.
 */
export interface CustomFieldUpdateCheckbox {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * slug
   */
  slug?: string | null;
  /**
   * type
   */
  type: "checkbox";
  /**
   * properties
   */
  properties?: CustomFieldCheckboxProperties | null;
} /**
 * Schema to update a custom field of type date.
 */
export interface CustomFieldUpdateDate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * slug
   */
  slug?: string | null;
  /**
   * type
   */
  type: "date";
  /**
   * properties
   */
  properties?: CustomFieldDateProperties | null;
} /**
 * Schema to update a custom field of type number.
 */
export interface CustomFieldUpdateNumber {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * slug
   */
  slug?: string | null;
  /**
   * type
   */
  type: "number";
  /**
   * properties
   */
  properties?: CustomFieldNumberProperties | null;
} /**
 * Schema to update a custom field of type select.
 */
export interface CustomFieldUpdateSelect {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * slug
   */
  slug?: string | null;
  /**
   * type
   */
  type: "select";
  /**
   * properties
   */
  properties?: CustomFieldSelectProperties | null;
} /**
 * Schema to update a custom field of type text.
 */
export interface CustomFieldUpdateText {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * slug
   */
  slug?: string | null;
  /**
   * type
   */
  type: "text";
  /**
   * properties
   */
  properties?: CustomFieldTextProperties | null;
} /**
 * CustomerBenefitGrantCustomUpdate
 */
export interface CustomerBenefitGrantCustomUpdate {
  /**
   * benefit_type
   */
  benefit_type: "custom";
} /**
 * CustomerBenefitGrantDiscordPropertiesUpdate
 */
export interface CustomerBenefitGrantDiscordPropertiesUpdate {
  /**
   * account_id
   */
  account_id: string | null;
} /**
 * CustomerBenefitGrantDiscordUpdate
 */
export interface CustomerBenefitGrantDiscordUpdate {
  /**
   * benefit_type
   */
  benefit_type: "discord";
  /**
   * properties
   */
  properties: CustomerBenefitGrantDiscordPropertiesUpdate;
} /**
 * CustomerBenefitGrantDownloadablesUpdate
 */
export interface CustomerBenefitGrantDownloadablesUpdate {
  /**
   * benefit_type
   */
  benefit_type: "downloadables";
} /**
 * CustomerBenefitGrantFeatureFlagUpdate
 */
export interface CustomerBenefitGrantFeatureFlagUpdate {
  /**
   * benefit_type
   */
  benefit_type: "feature_flag";
} /**
 * CustomerBenefitGrantGitHubRepositoryPropertiesUpdate
 */
export interface CustomerBenefitGrantGitHubRepositoryPropertiesUpdate {
  /**
   * account_id
   */
  account_id: string | null;
} /**
 * CustomerBenefitGrantGitHubRepositoryUpdate
 */
export interface CustomerBenefitGrantGitHubRepositoryUpdate {
  /**
   * benefit_type
   */
  benefit_type: "github_repository";
  /**
   * properties
   */
  properties: CustomerBenefitGrantGitHubRepositoryPropertiesUpdate;
} /**
 * CustomerBenefitGrantLicenseKeysUpdate
 */
export interface CustomerBenefitGrantLicenseKeysUpdate {
  /**
   * benefit_type
   */
  benefit_type: "license_keys";
} /**
 * CustomerBenefitGrantMeterCreditUpdate
 */
export interface CustomerBenefitGrantMeterCreditUpdate {
  /**
   * benefit_type
   */
  benefit_type: "meter_credit";
} /**
 * CustomerBenefitGrantSlackSharedChannelPropertiesUpdate
 */
export interface CustomerBenefitGrantSlackSharedChannelPropertiesUpdate {
  /**
   * invited_email
   */
  invited_email: string;
} /**
 * CustomerBenefitGrantSlackSharedChannelUpdate
 */
export interface CustomerBenefitGrantSlackSharedChannelUpdate {
  /**
   * benefit_type
   */
  benefit_type: "slack_shared_channel";
  /**
   * properties
   */
  properties: CustomerBenefitGrantSlackSharedChannelPropertiesUpdate;
} /**
 * CustomerEmailUpdateRequest
 */
export interface CustomerEmailUpdateRequest {
  /**
   * email
   */
  email: string;
} /**
 * CustomerEmailUpdateVerifyRequest
 */
export interface CustomerEmailUpdateVerifyRequest {
  /**
   * token
   */
  token: string;
} /**
 * CustomerIndividualCreate
 */
export interface CustomerIndividualCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.
   */
  external_id?: string | null;
  /**
   * name
   */
  name?: string | null;
  /**
   * billing_address
   */
  billing_address?: AddressInput | null;
  /**
   * tax_id
   */
  tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * The ID of the organization owning the customer. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer's email and name.
   */
  owner?: MemberOwnerCreate | null;
  /**
   * type
   */
  type?: "individual";
  /**
   * The email address of the customer. This must be unique within the organization.
   */
  email: string;
} /**
 * Schema to confirm a retry payment using either a saved payment method or a new confirmation token.
 */
export interface CustomerOrderConfirmPayment {
  /**
   * ID of the Stripe confirmation token for new payment methods.
   */
  confirmation_token_id?: string | null;
  /**
   * ID of an existing saved payment method.
   */
  payment_method_id?: string | null;
  /**
   * payment_processor
   */
  payment_processor?: PaymentProcessor;
} /**
 * Schema to update an order.
 */
export interface CustomerOrderUpdate {
  /**
   * The name of the customer that should appear on the invoice.
   */
  billing_name?: string | null;
  /**
   * The address of the customer that should appear on the invoice. Country and state fields cannot be updated.
   */
  billing_address?: AddressInput | null;
} /**
 * CustomerPaymentMethodConfirm
 */
export interface CustomerPaymentMethodConfirm {
  /**
   * setup_intent_id
   */
  setup_intent_id: string;
  /**
   * set_default
   */
  set_default: boolean;
} /**
 * CustomerPaymentMethodCreate
 */
export interface CustomerPaymentMethodCreate {
  /**
   * confirmation_token_id
   */
  confirmation_token_id: string;
  /**
   * set_default
   */
  set_default: boolean;
  /**
   * return_url
   */
  return_url: string;
} /**
 * CustomerPortalCustomerSettings
 */
export interface CustomerPortalCustomerSettings {
  /**
   * allow_email_change
   */
  allow_email_change?: boolean;
} /**
 * CustomerPortalCustomerUpdate
 */
export interface CustomerPortalCustomerUpdate {
  /**
   * billing_name
   */
  billing_name?: string | null;
  /**
   * billing_address
   */
  billing_address?: AddressInput | null;
  /**
   * tax_id
   */
  tax_id?: string | null;
  /**
   * default_payment_method_id
   */
  default_payment_method_id?: string | null;
} /**
 * Schema for adding a new member to the customer's team.
 */
export interface CustomerPortalMemberCreate {
  /**
   * The email address of the new member.
   */
  email: string;
  /**
   * The name of the new member (optional).
   */
  name?: string | null;
  /**
   * role
   */
  role?: MemberRole;
} /**
 * Schema for updating a member in the customer portal.
 */
export interface CustomerPortalMemberUpdate {
  /**
   * The new name for the member.
   */
  name?: string | null;
  /**
   * The new role for the member.
   */
  role?: MemberRole | null;
} /**
 * CustomerPortalSubscriptionSettings
 */
export interface CustomerPortalSubscriptionSettings {
  /**
   * update_seats
   */
  update_seats: boolean;
  /**
   * update_plan
   */
  update_plan: boolean;
} /**
 * CustomerPortalUsageSettings
 */
export interface CustomerPortalUsageSettings {
  /**
   * show
   */
  show: boolean;
} /**
 * CustomerSeatAssign
 */
export interface CustomerSeatAssign {
  /**
   * Subscription ID. Required if neither order_id nor checkout_id is provided.
   */
  subscription_id?: string | null;
  /**
   * Order ID for one-time purchases. Required if subscription_id is not provided.
   */
  order_id?: string | null;
  /**
   * Email of the customer to assign the seat to
   */
  email?: string | null;
  /**
   * External customer ID for the seat assignment
   */
  external_customer_id?: string | null;
  /**
   * Customer ID for the seat assignment
   */
  customer_id?: string | null;
  /**
   * External member ID for the seat assignment. Can be used alone (lookup existing member) or with email (create/validate member).
   */
  external_member_id?: string | null;
  /**
   * Member ID for the seat assignment.
   */
  member_id?: string | null;
  /**
   * Additional metadata for the seat (max 10 keys, 1KB total)
   */
  metadata?: Record<string, unknown> | null;
  /**
   * If true, the seat will be immediately claimed without sending an invitation email. API-only feature.
   */
  immediate_claim?: boolean;
  /**
   * Checkout ID. Resolves to the subscription or order produced by the checkout.
   */
  checkout_id?: string | null;
} /**
 * Schema for creating a customer session using an external customer ID.
 */
export interface CustomerSessionCustomerExternalIDCreate {
  /**
   * ID of the member to create a session for. When not provided and the organization has `member_model_enabled`, the owner member of the customer will be used for individual customers.
   */
  member_id?: string | null;
  /**
   * External ID of the member to create a session for. Alternative to `member_id`.
   */
  external_member_id?: string | null;
  /**
   * When set, a back button will be shown in the customer portal to return to this URL.
   */
  return_url?: string | null;
  /**
   * External ID of the customer to create a session for.
   */
  external_customer_id: string;
} /**
 * Schema for creating a customer session using a customer ID.
 */
export interface CustomerSessionCustomerIDCreate {
  /**
   * ID of the member to create a session for. When not provided and the organization has `member_model_enabled`, the owner member of the customer will be used for individual customers.
   */
  member_id?: string | null;
  /**
   * External ID of the member to create a session for. Alternative to `member_id`.
   */
  external_member_id?: string | null;
  /**
   * When set, a back button will be shown in the customer portal to return to this URL.
   */
  return_url?: string | null;
  /**
   * ID of the customer to create a session for.
   */
  customer_id: string;
} /**
 * CustomerSubscriptionCancel
 */
export interface CustomerSubscriptionCancel {
  /**
   * Cancel an active subscription once the current period ends.

Or uncancel a subscription currently set to be revoked at period end.
   */
  cancel_at_period_end?: boolean | null;
  /**
   * Customers reason for cancellation.

* `too_expensive`: Too expensive for the customer.
* `missing_features`: Customer is missing certain features.
* `switched_service`: Customer switched to another service.
* `unused`: Customer is not using it enough.
* `customer_service`: Customer is not satisfied with the customer service.
* `low_quality`: Customer is unhappy with the quality.
* `too_complex`: Customer considers the service too complicated.
* `other`: Other reason(s).
   */
  cancellation_reason?: CustomerCancellationReason | null;
  /**
   * Customer feedback and why they decided to cancel.
   */
  cancellation_comment?: string | null;
} /**
 * CustomerSubscriptionUpdateClear
 */
export interface CustomerSubscriptionUpdateClear {
  /**
   * Clear the pending subscription update.
   */
  pending_update: null;
} /**
 * CustomerSubscriptionUpdateProduct
 */
export interface CustomerSubscriptionUpdateProduct {
  /**
   * Update subscription to another product.
   */
  product_id: string;
} /**
 * CustomerSubscriptionUpdateSeats
 */
export interface CustomerSubscriptionUpdateSeats {
  /**
   * Update the number of seats for this subscription.
   */
  seats: number;
  /**
   * Determine how to handle the proration billing. If not provided, will use the default organization setting.
   */
  proration_behavior?: SubscriptionProrationBehavior | null;
} /**
 * CustomerTeamCreate
 */
export interface CustomerTeamCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.
   */
  external_id?: string | null;
  /**
   * name
   */
  name?: string | null;
  /**
   * billing_address
   */
  billing_address?: AddressInput | null;
  /**
   * tax_id
   */
  tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * The ID of the organization owning the customer. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer's email and name.
   */
  owner?: MemberOwnerCreate | null;
  /**
   * type
   */
  type: "team";
  /**
   * The email address of the team customer. Optional for team customers — if omitted, an owner with an email must be provided.
   */
  email?: string | null;
} /**
 * CustomerUpdate
 */
export interface CustomerUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The email address of the customer. This must be unique within the organization.
   */
  email?: string | null;
  /**
   * name
   */
  name?: string | null;
  /**
   * billing_address
   */
  billing_address?: AddressInput | null;
  /**
   * tax_id
   */
  tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
  /**
   * The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.
   */
  external_id?: string | null;
  /**
   * The customer type. Can only be upgraded from 'individual' to 'team', never downgraded.
   */
  type?: CustomerType | null;
} /**
 * CustomerUpdateExternalID
 */
export interface CustomerUpdateExternalID {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The email address of the customer. This must be unique within the organization.
   */
  email?: string | null;
  /**
   * name
   */
  name?: string | null;
  /**
   * billing_address
   */
  billing_address?: AddressInput | null;
  /**
   * tax_id
   */
  tax_id?: string | null;
  /**
   * locale
   */
  locale?: string | null;
} /**
 * Schema to create a fixed amount discount.
 */
export interface DiscountFixedCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * Name of the discount. Will be displayed to the customer when the discount is applied.
   */
  name: string;
  /**
   * Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API.
   */
  code?: string | null;
  /**
   * Optional timestamp after which the discount is redeemable.
   */
  starts_at?: string | null;
  /**
   * Optional timestamp after which the discount is no longer redeemable.
   */
  ends_at?: string | null;
  /**
   * Optional maximum number of times the discount can be redeemed.
   */
  max_redemptions?: number | null;
  /**
   * products
   */
  products?: string[] | null;
  /**
   * The ID of the organization owning the discount. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * type
   */
  type?: "fixed";
  /**
   * duration
   */
  duration: DiscountDuration;
  /**
   * Number of months the discount should be applied.

Required when `duration` is `repeating`. Must be omitted otherwise.

For this to work on yearly pricing, you should multiply this by 12.
For example, to apply the discount for 2 years, set this to 24.
   */
  duration_in_months?: number | null;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * currency
   */
  currency?: PresentmentCurrency | null;
  /**
   * amounts
   */
  amounts?: Record<string, number> | null;
} /**
 * Schema to create a percentage discount.
 */
export interface DiscountPercentageCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * Name of the discount. Will be displayed to the customer when the discount is applied.
   */
  name: string;
  /**
   * Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API.
   */
  code?: string | null;
  /**
   * Optional timestamp after which the discount is redeemable.
   */
  starts_at?: string | null;
  /**
   * Optional timestamp after which the discount is no longer redeemable.
   */
  ends_at?: string | null;
  /**
   * Optional maximum number of times the discount can be redeemed.
   */
  max_redemptions?: number | null;
  /**
   * products
   */
  products?: string[] | null;
  /**
   * The ID of the organization owning the discount. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * type
   */
  type?: "percentage";
  /**
   * duration
   */
  duration: DiscountDuration;
  /**
   * Number of months the discount should be applied.

Required when `duration` is `repeating`. Must be omitted otherwise.

For this to work on yearly pricing, you should multiply this by 12.
For example, to apply the discount for 2 years, set this to 24.
   */
  duration_in_months?: number | null;
  /**
   * Discount percentage in basis points.

A basis point is 1/100th of a percent.
For example, to create a 25.5% discount, set this to 2550.
   */
  basis_points: number;
} /**
 * Schema to update a discount.
 */
export interface DiscountUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * name
   */
  name?: string | null;
  /**
   * Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API.
   */
  code?: string | null;
  /**
   * Optional timestamp after which the discount is redeemable.
   */
  starts_at?: string | null;
  /**
   * Optional timestamp after which the discount is no longer redeemable.
   */
  ends_at?: string | null;
  /**
   * Optional maximum number of times the discount can be redeemed.
   */
  max_redemptions?: number | null;
  /**
   * duration
   */
  duration?: DiscountDuration | null;
  /**
   * duration_in_months
   */
  duration_in_months?: number | null;
  /**
   * type
   */
  type?: DiscountType | null;
  /**
   * amount
   */
  amount?: number | null;
  /**
   * currency
   */
  currency?: PresentmentCurrency | null;
  /**
   * amounts
   */
  amounts?: Record<string, number> | null;
  /**
   * basis_points
   */
  basis_points?: number | null;
  /**
   * products
   */
  products?: string[] | null;
} /**
 * Schema to create a file to be associated with the downloadables benefit.
 */
export interface DownloadableFileCreate {
  /**
   * organization_id
   */
  organization_id?: string | null;
  /**
   * name
   */
  name: string;
  /**
   * mime_type
   */
  mime_type: string;
  /**
   * size
   */
  size: number;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64?: string | null;
  /**
   * upload
   */
  upload: S3FileCreateMultipart;
  /**
   * service
   */
  service: "downloadable";
  /**
   * version
   */
  version?: string | null;
} /**
 * EventCreateCustomer
 */
export interface EventCreateCustomer {
  /**
   * The timestamp of the event.
   */
  timestamp?: string;
  /**
   * The name of the event.
   */
  name: string;
  /**
   * The ID of the organization owning the event. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * Your unique identifier for this event. Useful for deduplication and parent-child relationships.
   */
  external_id?: string | null;
  /**
   * The ID of the parent event. Can be either a Polar event ID (UUID) or an external event ID.
   */
  parent_id?: string | null;
  /**
   * metadata
   */
  metadata?: EventMetadataInput;
  /**
   * ID of the customer in your Polar organization associated with the event.
   */
  customer_id: string;
  /**
   * ID of the member within the customer's organization who performed the action. Used for member-level attribution in B2B.
   */
  member_id?: string | null;
} /**
 * EventCreateExternalCustomer
 */
export interface EventCreateExternalCustomer {
  /**
   * The timestamp of the event.
   */
  timestamp?: string;
  /**
   * The name of the event.
   */
  name: string;
  /**
   * The ID of the organization owning the event. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * Your unique identifier for this event. Useful for deduplication and parent-child relationships.
   */
  external_id?: string | null;
  /**
   * The ID of the parent event. Can be either a Polar event ID (UUID) or an external event ID.
   */
  parent_id?: string | null;
  /**
   * metadata
   */
  metadata?: EventMetadataInput;
  /**
   * ID of the customer in your system associated with the event.
   */
  external_customer_id: string;
  /**
   * ID of the member in your system within the customer's organization who performed the action. Used for member-level attribution in B2B.
   */
  external_member_id?: string | null;
} /**
 * EventMetadataInput
 */
export interface EventMetadataInput {
  /**
   * _cost
   */
  _cost?: CostMetadataInput;
  /**
   * _llm
   */
  _llm?: LLMMetadata;
} /**
 * EventTypeUpdate
 */
export interface EventTypeUpdate {
  /**
   * The label for the event type.
   */
  label: string;
  /**
   * Property path to extract dynamic label from event metadata (e.g., 'subject' or 'metadata.subject').
   */
  label_property_selector?: string | null;
} /**
 * EventsIngest
 */
export interface EventsIngest {
  /**
   * List of events to ingest.
   */
  events: EventCreateCustomer | EventCreateExternalCustomer[];
} /**
 * A price that already exists for this product.

Useful when updating a product if you want to keep an existing price.
 */
export interface ExistingProductPrice {
  /**
   * id
   */
  id: string;
} /**
 * FilePatch
 */
export interface FilePatch {
  /**
   * name
   */
  name?: string | null;
  /**
   * version
   */
  version?: string | null;
} /**
 * FileUploadCompleted
 */
export interface FileUploadCompleted {
  /**
   * id
   */
  id: string;
  /**
   * path
   */
  path: string;
  /**
   * parts
   */
  parts: S3FileUploadCompletedPart[];
} /**
 * Filter
 */
export interface Filter {
  /**
   * conjunction
   */
  conjunction: FilterConjunction;
  /**
   * clauses
   */
  clauses: FilterClause | Filter[];
} /**
 * FilterClause
 */
export interface FilterClause {
  /**
   * property
   */
  property: string;
  /**
   * operator
   */
  operator: FilterOperator;
  /**
   * value
   */
  value: string | number | boolean;
} /**
 * LLMMetadata
 */
export interface LLMMetadata {
  /**
   * The vendor of the event.
   */
  vendor: string;
  /**
   * The model used for the event.
   */
  model: string;
  /**
   * The LLM prompt used for the event.
   */
  prompt?: string | null;
  /**
   * The LLM response used for the event.
   */
  response?: string | null;
  /**
   * The number of LLM input tokens used for the event.
   */
  input_tokens: number;
  /**
   * The number of LLM cached tokens that were used for the event.
   */
  cached_input_tokens?: number;
  /**
   * The number of LLM output tokens used for the event.
   */
  output_tokens: number;
  /**
   * The total number of LLM tokens used for the event.
   */
  total_tokens: number;
} /**
 * LicenseKeyActivate
 */
export interface LicenseKeyActivate {
  /**
   * key
   */
  key: string;
  /**
   * organization_id
   */
  organization_id: string;
  /**
   * label
   */
  label: string;
  /**
   * Key-value object allowing you to set conditions that must match when validating the license key.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  conditions?: Record<string, string | number | number | boolean>;
  /**
   * Key-value object allowing you to store additional information about the activation

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  meta?: Record<string, string | number | number | boolean>;
} /**
 * LicenseKeyDeactivate
 */
export interface LicenseKeyDeactivate {
  /**
   * key
   */
  key: string;
  /**
   * organization_id
   */
  organization_id: string;
  /**
   * activation_id
   */
  activation_id: string;
} /**
 * LicenseKeyUpdate
 */
export interface LicenseKeyUpdate {
  /**
   * status
   */
  status?: LicenseKeyStatus | null;
  /**
   * usage
   */
  usage?: number;
  /**
   * limit_activations
   */
  limit_activations?: number | null;
  /**
   * limit_usage
   */
  limit_usage?: number | null;
  /**
   * expires_at
   */
  expires_at?: string | null;
} /**
 * LicenseKeyValidate
 */
export interface LicenseKeyValidate {
  /**
   * key
   */
  key: string;
  /**
   * organization_id
   */
  organization_id: string;
  /**
   * activation_id
   */
  activation_id?: string | null;
  /**
   * benefit_id
   */
  benefit_id?: string | null;
  /**
   * customer_id
   */
  customer_id?: string | null;
  /**
   * increment_usage
   */
  increment_usage?: number | null;
  /**
   * Key-value object allowing you to set conditions that must match when validating the license key.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  conditions?: Record<string, string | number | number | boolean>;
} /**
 * Schema for creating a new member.
 */
export interface MemberCreate {
  /**
   * The ID of the customer this member belongs to.
   */
  customer_id: string;
  /**
   * The email address of the member.
   */
  email: string;
  /**
   * name
   */
  name?: string | null;
  /**
   * The ID of the member in your system. This must be unique within the customer.
   */
  external_id?: string | null;
  /**
   * The role of the member within the customer. To assign or transfer ownership, use the member update endpoint.
   */
  role?: Role;
} /**
 * Schema for creating an owner member during customer creation.
 */
export interface MemberOwnerCreate {
  /**
   * The email address of the member.
   */
  email: string;
  /**
   * name
   */
  name?: string | null;
  /**
   * The ID of the member in your system. This must be unique within the customer.
   */
  external_id?: string | null;
} /**
 * Schema for updating a member.
 */
export interface MemberUpdate {
  /**
   * name
   */
  name?: string | null;
  /**
   * email
   */
  email?: string | null;
  /**
   * The role of the member within the customer.
   */
  role?: MemberRole | null;
} /**
 * MeterCreate
 */
export interface MeterCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The name of the meter. Will be shown on customer's invoices and usage.
   */
  name: string;
  /**
   * unit
   */
  unit?: MeterUnit;
  /**
   * The label for the custom unit, e.g. 'request'. Required when unit is 'custom'.
   */
  custom_label?: string | null;
  /**
   * The multiplier to convert from the base unit to display scale, e.g. 1000 to display per 1000 units. Defaults to 1 when not provided.
   */
  custom_multiplier?: number | null;
  /**
   * filter
   */
  filter: Filter;
  /**
   * The aggregation to apply on the filtered events to calculate the meter.
   */
  aggregation: CountAggregation | PropertyAggregation | UniqueAggregation;
  /**
   * The ID of the organization owning the meter. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
} /**
 * MeterUpdate
 */
export interface MeterUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The name of the meter. Will be shown on customer's invoices and usage.
   */
  name?: string | null;
  /**
   * The unit of the meter.
   */
  unit?: MeterUnit | null;
  /**
   * The label for the custom unit. Required when unit is 'custom'.
   */
  custom_label?: string | null;
  /**
   * The multiplier to convert from base unit to display scale. Required when unit is 'custom'.
   */
  custom_multiplier?: number | null;
  /**
   * The filter to apply on events that'll be used to calculate the meter.
   */
  filter?: Filter | null;
  /**
   * The aggregation to apply on the filtered events to calculate the meter.
   */
  aggregation?: CountAggregation | PropertyAggregation | UniqueAggregation | null;
  /**
   * Whether the meter is archived. Archived meters are no longer used for billing.
   */
  is_archived?: boolean | null;
} /**
 * Schema for creating a metrics dashboard.
 */
export interface MetricDashboardCreate {
  /**
   * Display name for the dashboard.
   */
  name: string;
  /**
   * List of metric slugs to display in this dashboard.
   */
  metrics?: string[];
  /**
   * The ID of the organization owning this dashboard. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
} /**
 * Schema for updating a metrics dashboard.
 */
export interface MetricDashboardUpdate {
  /**
   * Display name for the dashboard.
   */
  name?: string | null;
  /**
   * List of metric slugs to display in this dashboard.
   */
  metrics?: string[] | null;
} /**
 * OAuth2ClientConfiguration
 */
export interface OAuth2ClientConfiguration {
  /**
   * redirect_uris
   */
  redirect_uris: string[];
  /**
   * token_endpoint_auth_method
   */
  token_endpoint_auth_method?: TokenEndpointAuthMethod;
  /**
   * grant_types
   */
  grant_types?: "authorization_code" | "refresh_token"[];
  /**
   * response_types
   */
  response_types?: "code"[];
  /**
   * scope
   */
  scope?: string;
  /**
   * client_name
   */
  client_name: string;
  /**
   * client_uri
   */
  client_uri?: string | null;
  /**
   * logo_uri
   */
  logo_uri?: string | null;
  /**
   * tos_uri
   */
  tos_uri?: string | null;
  /**
   * policy_uri
   */
  policy_uri?: string | null;
  /**
   * default_sub_type
   */
  default_sub_type?: SubType;
} /**
 * OAuth2ClientConfigurationUpdate
 */
export interface OAuth2ClientConfigurationUpdate {
  /**
   * redirect_uris
   */
  redirect_uris: string[];
  /**
   * token_endpoint_auth_method
   */
  token_endpoint_auth_method?: TokenEndpointAuthMethod;
  /**
   * grant_types
   */
  grant_types?: "authorization_code" | "refresh_token"[];
  /**
   * response_types
   */
  response_types?: "code"[];
  /**
   * scope
   */
  scope?: string;
  /**
   * client_name
   */
  client_name: string;
  /**
   * client_uri
   */
  client_uri?: string | null;
  /**
   * logo_uri
   */
  logo_uri?: string | null;
  /**
   * tos_uri
   */
  tos_uri?: string | null;
  /**
   * policy_uri
   */
  policy_uri?: string | null;
  /**
   * default_sub_type
   */
  default_sub_type?: SubType;
  /**
   * client_id
   */
  client_id: string;
} /**
 * Schema to create a draft order for an off-session charge.
 */
export interface OrderCreate {
  /**
   * Key-value object storing custom field values.
   */
  custom_field_data?: Record<string, string | number | boolean | string | null>;
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The ID of the organization the order belongs to. **Required unless you use an organization token.** The customer and product must belong to this organization.
   */
  organization_id?: string | null;
  /**
   * The ID of the customer the order is for. Must belong to the order's organization.
   */
  customer_id: string;
  /**
   * The ID of the one-time product to charge for. Must belong to the order's organization. Only fixed-price and free products are supported.
   */
  product_id: string;
  /**
   * The currency to charge in (ISO 4217, lowercase, e.g. `usd`). Defaults to the organization's default currency; specify it to force a different one, or when the product isn't priced in the organization's default currency.
   */
  currency?: string | null;
  /**
   * A custom amount to charge, in the smallest currency unit. Overrides the product's price; defaults to the product's configured price (0 for free products). A positive amount must be at least the currency's minimum.
   */
  amount?: number | null;
  /**
   * A custom description for the order's line item, shown on the invoice and receipt (e.g. `5,000 tokens`). Defaults to the product name.
   */
  description?: string | null;
} /**
 * Schema to finalize a draft order and trigger an off-session charge.
 */
export interface OrderFinalize {
  /**
   * ID of the payment method to charge. Must belong to the order's customer. Falls back to the customer's default payment method when unset.
   */
  payment_method_id?: string | null;
} /**
 * Schema to update an order.
 */
export interface OrderUpdate {
  /**
   * The name of the customer that should appear on the invoice.
   */
  billing_name?: string | null;
  /**
   * The address of the customer that should appear on the invoice. Country and state fields cannot be updated.
   */
  billing_address?: AddressInput | null;
} /**
 * Schema to create a file to be used as an organization avatar.
 */
export interface OrganizationAvatarFileCreate {
  /**
   * organization_id
   */
  organization_id?: string | null;
  /**
   * name
   */
  name: string;
  /**
   * MIME type of the file. Only images are supported for this type of file.
   */
  mime_type: string;
  /**
   * Size of the file. A maximum of 1 MB is allowed for this type of file.
   */
  size: number;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64?: string | null;
  /**
   * upload
   */
  upload: S3FileCreateMultipart;
  /**
   * service
   */
  service: "organization_avatar";
  /**
   * version
   */
  version?: string | null;
} /**
 * OrganizationCompanyLegalEntitySchema
 */
export interface OrganizationCompanyLegalEntitySchema {
  /**
   * type
   */
  type: "company";
  /**
   * registered_name
   */
  registered_name: string;
} /**
 * OrganizationCreate
 */
export interface OrganizationCreate {
  /**
   * name
   */
  name: string;
  /**
   * slug
   */
  slug: string;
  /**
   * avatar_url
   */
  avatar_url?: string | null;
  /**
   * legal_entity
   */
  legal_entity?:
    | OrganizationIndividualLegalEntitySchema
    | OrganizationCompanyLegalEntitySchema
    | null;
  /**
   * Public support email.
   */
  email?: string | null;
  /**
   * Official website of the organization.
   */
  website?: string | null;
  /**
   * Link to social profiles.
   */
  socials?: OrganizationSocialLink[] | null;
  /**
   * Additional, private, business details Polar needs about active organizations for compliance (KYC).
   */
  details?: OrganizationDetails | null;
  /**
   * Two-letter country code (ISO 3166-1 alpha-2).
   */
  country?: CountryAlpha2Input | null;
  /**
   * feature_settings
   */
  feature_settings?: OrganizationFeatureSettingsUpdate | null;
  /**
   * subscription_settings
   */
  subscription_settings?: OrganizationSubscriptionSettings | null;
  /**
   * customer_email_settings
   */
  customer_email_settings?: OrganizationCustomerEmailSettings | null;
  /**
   * customer_portal_settings
   */
  customer_portal_settings?: OrganizationCustomerPortalSettings | null;
  /**
   * default_presentment_currency
   */
  default_presentment_currency?: PresentmentCurrency;
  /**
   * default_tax_behavior
   */
  default_tax_behavior?: TaxBehaviorOption;
} /**
 * OrganizationCustomerEmailSettings
 */
export interface OrganizationCustomerEmailSettings {
  /**
   * order_confirmation
   */
  order_confirmation: boolean;
  /**
   * subscription_cancellation
   */
  subscription_cancellation: boolean;
  /**
   * subscription_confirmation
   */
  subscription_confirmation: boolean;
  /**
   * subscription_cycled
   */
  subscription_cycled: boolean;
  /**
   * subscription_cycled_after_trial
   */
  subscription_cycled_after_trial: boolean;
  /**
   * subscription_past_due
   */
  subscription_past_due: boolean;
  /**
   * subscription_renewal_reminder
   */
  subscription_renewal_reminder: boolean;
  /**
   * subscription_revoked
   */
  subscription_revoked: boolean;
  /**
   * subscription_trial_conversion_reminder
   */
  subscription_trial_conversion_reminder: boolean;
  /**
   * subscription_uncanceled
   */
  subscription_uncanceled: boolean;
  /**
   * subscription_updated
   */
  subscription_updated: boolean;
} /**
 * OrganizationCustomerPortalSettings
 */
export interface OrganizationCustomerPortalSettings {
  /**
   * usage
   */
  usage: CustomerPortalUsageSettings;
  /**
   * subscription
   */
  subscription: CustomerPortalSubscriptionSettings;
  /**
   * customer
   */
  customer?: CustomerPortalCustomerSettings;
} /**
 * OrganizationDetails
 */
export interface OrganizationDetails {
  /**
   * Brief information about you and your business.
   */
  about?: string | null;
  /**
   * Description of digital products being sold.
   */
  product_description?: string | null;
  /**
   * Categories of products being sold.
   */
  selling_categories?: string[];
  /**
   * Pricing models used by the organization.
   */
  pricing_models?: string[];
  /**
   * How the organization will integrate and use Polar.
   */
  intended_use?: string | null;
  /**
   * Main customer acquisition channels.
   */
  customer_acquisition?: string[];
  /**
   * Estimated revenue in the next 12 months
   */
  future_annual_revenue?: number | null;
  /**
   * Switching from another platform?
   */
  switching?: boolean;
  /**
   * Which platform the organization is migrating from.
   */
  switching_from?: "paddle" | "lemon_squeezy" | "gumroad" | "stripe" | "other" | null;
  /**
   * Revenue from last year if applicable.
   */
  previous_annual_revenue?: number | null;
} /**
 * Feature settings that organizations can update themselves.

Other feature settings are managed by Polar staff: they're ignored if
provided and keep their current value.
 */
export interface OrganizationFeatureSettingsUpdate {
  /**
   * If this organization has seat-based pricing enabled
   */
  seat_based_pricing_enabled?: boolean;
  /**
   * If this organization has the Member model enabled
   */
  member_model_enabled?: boolean;
  /**
   * If this organization has checkout localization enabled
   */
  checkout_localization_enabled?: boolean;
  /**
   * Ordered list of metric slugs shown on the dashboard overview.
   */
  overview_metrics?: string[] | null;
} /**
 * OrganizationIndividualLegalEntitySchema
 */
export interface OrganizationIndividualLegalEntitySchema {
  /**
   * type
   */
  type: "individual";
} /**
 * OrganizationSocialLink
 */
export interface OrganizationSocialLink {
  /**
   * platform
   */
  platform: OrganizationSocialPlatforms;
  /**
   * The URL to the organization profile
   */
  url: string;
} /**
 * OrganizationSubscriptionSettings
 */
export interface OrganizationSubscriptionSettings {
  /**
   * allow_multiple_subscriptions
   */
  allow_multiple_subscriptions: boolean;
  /**
   * proration_behavior
   */
  proration_behavior: PublicSubscriptionProrationBehavior;
  /**
   * benefit_revocation_grace_period
   */
  benefit_revocation_grace_period: number;
  /**
   * prevent_trial_abuse
   */
  prevent_trial_abuse: boolean;
  /**
   * allow_customer_updates
   */
  allow_customer_updates: boolean;
} /**
 * OrganizationUpdate
 */
export interface OrganizationUpdate {
  /**
   * name
   */
  name?: string | null;
  /**
   * avatar_url
   */
  avatar_url?: string | null;
  /**
   * Public support email.
   */
  email?: string | null;
  /**
   * Official website of the organization.
   */
  website?: string | null;
  /**
   * Links to social profiles.
   */
  socials?: OrganizationSocialLink[] | null;
  /**
   * Additional, private, business details Polar needs about active organizations for compliance (KYC).
   */
  details?: OrganizationDetails | null;
  /**
   * Two-letter country code (ISO 3166-1 alpha-2).
   */
  country?: CountryAlpha2Input | null;
  /**
   * feature_settings
   */
  feature_settings?: OrganizationFeatureSettingsUpdate | null;
  /**
   * subscription_settings
   */
  subscription_settings?: OrganizationSubscriptionSettings | null;
  /**
   * customer_email_settings
   */
  customer_email_settings?: OrganizationCustomerEmailSettings | null;
  /**
   * customer_portal_settings
   */
  customer_portal_settings?: OrganizationCustomerPortalSettings | null;
  /**
   * Default presentment currency for the organization
   */
  default_presentment_currency?: PresentmentCurrency | null;
  /**
   * Default tax behavior applied on products.
   */
  default_tax_behavior?: TaxBehaviorOption | null;
} /**
 * Schema to update the benefits granted by a product.
 */
export interface ProductBenefitsUpdate {
  /**
   * List of benefit IDs. Each one must be on the same organization as the product.
   */
  benefits: string[];
} /**
 * ProductCreateOneTime
 */
export interface ProductCreateOneTime {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The name of the product.
   */
  name: string;
  /**
   * The description of the product.
   */
  description?: string | null;
  /**
   * visibility
   */
  visibility?: ProductVisibility;
  /**
   * List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products.
   */
  prices:
    | ProductPriceFixedCreate
    | ProductPriceCustomCreate
    | ProductPriceSeatBasedCreate
    | ProductPriceMeteredUnitCreate[];
  /**
   * List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded.
   */
  medias?: string[] | null;
  /**
   * List of custom fields to attach.
   */
  attached_custom_fields?: AttachedCustomFieldCreate[];
  /**
   * The ID of the organization owning the product. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * States that the product is a one-time purchase.
   */
  recurring_interval?: null;
  /**
   * One-time products don't have a recurring interval count.
   */
  recurring_interval_count?: null;
} /**
 * ProductCreateRecurring
 */
export interface ProductCreateRecurring {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The name of the product.
   */
  name: string;
  /**
   * The description of the product.
   */
  description?: string | null;
  /**
   * visibility
   */
  visibility?: ProductVisibility;
  /**
   * List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products.
   */
  prices:
    | ProductPriceFixedCreate
    | ProductPriceCustomCreate
    | ProductPriceSeatBasedCreate
    | ProductPriceMeteredUnitCreate[];
  /**
   * List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded.
   */
  medias?: string[] | null;
  /**
   * List of custom fields to attach.
   */
  attached_custom_fields?: AttachedCustomFieldCreate[];
  /**
   * The ID of the organization owning the product. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * recurring_interval
   */
  recurring_interval: SubscriptionRecurringInterval;
  /**
   * Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on.
   */
  recurring_interval_count?: number;
} /**
 * Schema to create a file to be used as a product media file.
 */
export interface ProductMediaFileCreate {
  /**
   * organization_id
   */
  organization_id?: string | null;
  /**
   * name
   */
  name: string;
  /**
   * MIME type of the file. Only images are supported for this type of file.
   */
  mime_type: string;
  /**
   * Size of the file. A maximum of 10 MB is allowed for this type of file.
   */
  size: number;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64?: string | null;
  /**
   * upload
   */
  upload: S3FileCreateMultipart;
  /**
   * service
   */
  service: "product_media";
  /**
   * version
   */
  version?: string | null;
} /**
 * Schema to create a pay-what-you-want price.
 */
export interface ProductPriceCustomCreate {
  /**
   * amount_type
   */
  amount_type: "custom";
  /**
   * price_currency
   */
  price_currency?: PresentmentCurrency;
  /**
   * The tax behavior of the price. If not set, it will default to the organization's default tax behavior.
   */
  tax_behavior?: TaxBehaviorOption | null;
  /**
   * The minimum amount the customer can pay. If set to 0, the price is 'free or pay what you want' and $0 is accepted. If set to a value below the minimum price amount for the currency, it will be rejected. Defaults to the minimum price amount for the currency. Minimum per currency:
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
- Other currencies: 50 minor units
   */
  minimum_amount?: number;
  /**
   * The maximum amount the customer can pay. Maximum per currency:
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
- Other currencies: 99,999,999 minor units
   */
  maximum_amount?: number | null;
  /**
   * The initial amount shown to the customer. If 0, the customer will see $0 as the default. If set to a value below the minimum price amount for the currency, it will be rejected.Minimum per currency:
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
- Other currencies: 50 minor units
   */
  preset_amount?: number | null;
} /**
 * Schema to create a fixed price.
 */
export interface ProductPriceFixedCreate {
  /**
   * amount_type
   */
  amount_type: "fixed";
  /**
   * price_currency
   */
  price_currency?: PresentmentCurrency;
  /**
   * The tax behavior of the price. If not set, it will default to the organization's default tax behavior.
   */
  tax_behavior?: TaxBehaviorOption | null;
  /**
   * The price in cents. Set to `0` for a free price.
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
- Other currencies: 50 minor units
   */
  price_amount: number;
} /**
 * Schema to create a metered price with a fixed unit price.
 */
export interface ProductPriceMeteredUnitCreate {
  /**
   * amount_type
   */
  amount_type: "metered_unit";
  /**
   * price_currency
   */
  price_currency?: PresentmentCurrency;
  /**
   * The tax behavior of the price. If not set, it will default to the organization's default tax behavior.
   */
  tax_behavior?: TaxBehaviorOption | null;
  /**
   * The ID of the meter associated to the price.
   */
  meter_id: string;
  /**
   * The price per unit in cents. Supports up to 12 decimal places.
   */
  unit_amount: number | string;
  /**
   * Optional maximum amount in cents that can be charged, regardless of the number of units consumed.
   */
  cap_amount?: number | null;
} /**
 * Schema to create a seat-based price with volume-based tiers.
 */
export interface ProductPriceSeatBasedCreate {
  /**
   * amount_type
   */
  amount_type: "seat_based";
  /**
   * price_currency
   */
  price_currency?: PresentmentCurrency;
  /**
   * The tax behavior of the price. If not set, it will default to the organization's default tax behavior.
   */
  tax_behavior?: TaxBehaviorOption | null;
  /**
   * seat_tiers
   */
  seat_tiers: ProductPriceSeatTiersInput;
} /**
 * A pricing tier for seat-based pricing.
 */
export interface ProductPriceSeatTier {
  /**
   * Minimum number of seats (inclusive)
   */
  min_seats: number;
  /**
   * Maximum number of seats (inclusive). None for unlimited.
   */
  max_seats?: number | null;
  /**
   * Price per seat in cents for this tier
   */
  price_per_seat: number;
} /**
 * List of pricing tiers for seat-based pricing.

The minimum and maximum seat limits are derived from the tiers:
- minimum_seats = first tier's min_seats
- maximum_seats = last tier's max_seats (None for unlimited)
 */
export interface ProductPriceSeatTiersInput {
  /**
   * seat_tier_type
   */
  seat_tier_type?: SeatTierType;
  /**
   * List of pricing tiers
   */
  tiers: ProductPriceSeatTier[];
} /**
 * Schema to update a product.
 */
export interface ProductUpdate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The interval unit for the trial period.
   */
  trial_interval?: TrialInterval | null;
  /**
   * The number of interval units for the trial period.
   */
  trial_interval_count?: number | null;
  /**
   * name
   */
  name?: string | null;
  /**
   * The description of the product.
   */
  description?: string | null;
  /**
   * The recurring interval of the product. If `None`, the product is a one-time purchase. **Can only be set on legacy recurring products. Once set, it can't be changed.**
   */
  recurring_interval?: SubscriptionRecurringInterval | null;
  /**
   * Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. Once set, it can't be changed.**
   */
  recurring_interval_count?: number | null;
  /**
   * Whether the product is archived. If `true`, the product won't be available for purchase anymore. Existing customers will still have access to their benefits, and subscriptions will continue normally.
   */
  is_archived?: boolean | null;
  /**
   * The visibility of the product.
   */
  visibility?: ProductVisibility | null;
  /**
   * List of available prices for this product. If you want to keep existing prices, include them in the list as an `ExistingProductPrice` object.
   */
  prices?:
    | ExistingProductPrice
    | ProductPriceFixedCreate
    | ProductPriceCustomCreate
    | ProductPriceSeatBasedCreate
    | ProductPriceMeteredUnitCreate[]
    | null;
  /**
   * List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded.
   */
  medias?: string[] | null;
  /**
   * attached_custom_fields
   */
  attached_custom_fields?: AttachedCustomFieldCreate[] | null;
} /**
 * PropertyAggregation
 */
export interface PropertyAggregation {
  /**
   * func
   */
  func: Func;
  /**
   * property
   */
  property: string;
} /**
 * RefundCreate
 */
export interface RefundCreate {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * order_id
   */
  order_id: string;
  /**
   * reason
   */
  reason: RefundReason;
  /**
   * Amount to refund in cents. Minimum is 1.
   */
  amount: number;
  /**
   * An internal comment about the refund.
   */
  comment?: string | null;
  /**
   * Should this refund trigger the associated customer benefits to be revoked?

**Note:**
Only allowed in case the `order` is a one-time purchase.
Subscriptions automatically revoke customer benefits once the
subscription itself is revoked, i.e fully canceled.
   */
  revoke_benefits?: boolean;
} /**
 * S3FileCreateMultipart
 */
export interface S3FileCreateMultipart {
  /**
   * parts
   */
  parts: S3FileCreatePart[];
} /**
 * S3FileCreatePart
 */
export interface S3FileCreatePart {
  /**
   * number
   */
  number: number;
  /**
   * chunk_start
   */
  chunk_start: number;
  /**
   * chunk_end
   */
  chunk_end: number;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64?: string | null;
} /**
 * S3FileUploadCompletedPart
 */
export interface S3FileUploadCompletedPart {
  /**
   * number
   */
  number: number;
  /**
   * checksum_etag
   */
  checksum_etag: string;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64: string | null;
} /**
 * SeatAssign
 */
export interface SeatAssign {
  /**
   * Subscription ID. Required if neither order_id nor checkout_id is provided.
   */
  subscription_id?: string | null;
  /**
   * Order ID for one-time purchases. Required if subscription_id is not provided.
   */
  order_id?: string | null;
  /**
   * Email of the customer to assign the seat to
   */
  email?: string | null;
  /**
   * External customer ID for the seat assignment
   */
  external_customer_id?: string | null;
  /**
   * Customer ID for the seat assignment
   */
  customer_id?: string | null;
  /**
   * External member ID for the seat assignment. Can be used alone (lookup existing member) or with email (create/validate member).
   */
  external_member_id?: string | null;
  /**
   * Member ID for the seat assignment.
   */
  member_id?: string | null;
  /**
   * Additional metadata for the seat (max 10 keys, 1KB total)
   */
  metadata?: Record<string, unknown> | null;
  /**
   * If true, the seat will be immediately claimed without sending an invitation email. API-only feature.
   */
  immediate_claim?: boolean;
} /**
 * SeatClaim
 */
export interface SeatClaim {
  /**
   * Invitation token to claim the seat
   */
  invitation_token: string;
} /**
 * SubscriptionCancel
 */
export interface SubscriptionCancel {
  /**
   * Customer reason for cancellation.

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
* `other`: Other reason(s).
   */
  customer_cancellation_reason?: CustomerCancellationReason | null;
  /**
   * Customer feedback and why they decided to cancel.

**IMPORTANT:**
Do not use this to store internal notes! It's intended to be input
from the customer and is therefore also available in their Polar
purchases library.

Only set this in case your own service is requesting the reason from the
customer. Or you copy a message directly from a customer
conversation, i.e support.
   */
  customer_cancellation_comment?: string | null;
  /**
   * Cancel an active subscription once the current period ends.

Or uncancel a subscription currently set to be revoked at period end.
   */
  cancel_at_period_end: boolean;
} /**
 * Create a subscription for an existing customer.
 */
export interface SubscriptionCreateCustomer {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The ID of the recurring product to subscribe to. Must be a free product, otherwise the customer should go through a checkout flow.
   */
  product_id: string;
  /**
   * The ID of the customer to create the subscription for.
   */
  customer_id: string;
} /**
 * Create a subscription for an existing customer identified by an external ID.
 */
export interface SubscriptionCreateExternalCustomer {
  /**
   * Key-value object allowing you to store additional information.

The key must be a string with a maximum length of **40 characters**.
The value must be either:

* A string with a maximum length of **500 characters**
* An integer
* A floating-point number
* A boolean

You can store up to **50 key-value pairs**.
   */
  metadata?: Record<string, string | number | number | boolean>;
  /**
   * The ID of the recurring product to subscribe to. Must be a free product, otherwise the customer should go through a checkout flow.
   */
  product_id: string;
  /**
   * The ID of the customer in your system to create the subscription for. It must already exist in Polar.
   */
  external_customer_id: string;
} /**
 * SubscriptionRevoke
 */
export interface SubscriptionRevoke {
  /**
   * Customer reason for cancellation.

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
* `other`: Other reason(s).
   */
  customer_cancellation_reason?: CustomerCancellationReason | null;
  /**
   * Customer feedback and why they decided to cancel.

**IMPORTANT:**
Do not use this to store internal notes! It's intended to be input
from the customer and is therefore also available in their Polar
purchases library.

Only set this in case your own service is requesting the reason from the
customer. Or you copy a message directly from a customer
conversation, i.e support.
   */
  customer_cancellation_comment?: string | null;
  /**
   * Cancel and revoke an active subscription immediately
   */
  revoke: true;
} /**
 * SubscriptionUpdateBase
 */
export interface SubscriptionUpdateBase {
  /**
   * Update subscription to another product.
   */
  product_id?: string | null;
  /**
   * Determine how to handle the proration billing. If not provided, will use the default organization setting.
   */
  proration_behavior?: SubscriptionProrationBehavior | null;
  /**
   * Update the subscription to apply a new discount. If set to `null`, the discount will be removed. The change will be applied on the next billing cycle.
   */
  discount_id?: string | null;
  /**
   * Set or extend the trial period of the subscription. If set to `now`, the trial will end immediately.
   */
  trial_end?: string | "now" | null;
} /**
 * SubscriptionUpdateBillingPeriod
 */
export interface SubscriptionUpdateBillingPeriod {
  /**
   * Set a new date for the end of the current billing period. The subscription will renew on this date. The new date can be earlier or later than the current period end, as long as it's in the future.

It is not possible to update the current billing period on a canceled subscription.
   */
  current_billing_period_end: string;
} /**
 * SubscriptionUpdateClear
 */
export interface SubscriptionUpdateClear {
  /**
   * Clear the pending subscription update. Set to null to remove scheduled changes.
   */
  pending_update: null;
} /**
 * SubscriptionUpdateSeats
 */
export interface SubscriptionUpdateSeats {
  /**
   * Update the number of seats for this subscription.
   */
  seats: number;
  /**
   * Determine how to handle the proration billing. If not provided, will use the default organization setting.
   */
  proration_behavior?: SubscriptionProrationBehavior | null;
} /**
 * Schema to create a file attached to a support case.
 */
export interface SupportCaseAttachmentFileCreate {
  /**
   * organization_id
   */
  organization_id?: string | null;
  /**
   * name
   */
  name: string;
  /**
   * MIME type of the file. Images, videos, PDF, CSV, plain text, Word and Excel documents are supported.
   */
  mime_type: string;
  /**
   * Size of the file. A maximum of 250 MB is allowed for this type of file.
   */
  size: number;
  /**
   * checksum_sha256_base64
   */
  checksum_sha256_base64?: string | null;
  /**
   * upload
   */
  upload: S3FileCreateMultipart;
  /**
   * service
   */
  service: "support_case_attachment";
  /**
   * version
   */
  version?: string | null;
} /**
 * UniqueAggregation
 */
export interface UniqueAggregation {
  /**
   * func
   */
  func?: "unique";
  /**
   * property
   */
  property: string;
} /**
 * Schema to create a webhook endpoint.
 */
export interface WebhookEndpointCreate {
  /**
   * The URL where the webhook events will be sent.
   */
  url: string;
  /**
   * An optional name for the webhook endpoint to help organize and identify it.
   */
  name?: string | null;
  /**
   * format
   */
  format: WebhookFormat;
  /**
   * The events that will trigger the webhook.
   */
  events: WebhookEventType[];
  /**
   * The organization ID associated with the webhook endpoint. **Required unless you use an organization token.**
   */
  organization_id?: string | null;
} /**
 * Schema to update a webhook endpoint.
 */
export interface WebhookEndpointUpdate {
  /**
   * url
   */
  url?: string | null;
  /**
   * An optional name for the webhook endpoint to help organize and identify it.
   */
  name?: string | null;
  /**
   * format
   */
  format?: WebhookFormat | null;
  /**
   * events
   */
  events?: WebhookEventType[] | null;
  /**
   * Whether the webhook endpoint is enabled.
   */
  enabled?: boolean | null;
}
/**
 * BenefitCreate
 */
export type BenefitCreate =
  | BenefitCustomCreate
  | BenefitDiscordCreate
  | BenefitGitHubRepositoryCreate
  | BenefitDownloadablesCreate
  | BenefitLicenseKeysCreate
  | BenefitMeterCreditCreate
  | BenefitFeatureFlagCreate
  | BenefitSlackSharedChannelCreate;
/**
 * CheckoutLinkCreate
 */
export type CheckoutLinkCreate =
  | CheckoutLinkCreateProductPrice
  | CheckoutLinkCreateProduct
  | CheckoutLinkCreateProducts;
/**
 * CustomFieldCreate
 */
export type CustomFieldCreate =
  | CustomFieldCreateText
  | CustomFieldCreateNumber
  | CustomFieldCreateDate
  | CustomFieldCreateCheckbox
  | CustomFieldCreateSelect;
/**
 * CustomFieldUpdate
 */
export type CustomFieldUpdate =
  | CustomFieldUpdateText
  | CustomFieldUpdateNumber
  | CustomFieldUpdateDate
  | CustomFieldUpdateCheckbox
  | CustomFieldUpdateSelect;
/**
 * CustomerBenefitGrantUpdate
 */
export type CustomerBenefitGrantUpdate =
  | CustomerBenefitGrantDiscordUpdate
  | CustomerBenefitGrantGitHubRepositoryUpdate
  | CustomerBenefitGrantDownloadablesUpdate
  | CustomerBenefitGrantLicenseKeysUpdate
  | CustomerBenefitGrantCustomUpdate
  | CustomerBenefitGrantMeterCreditUpdate
  | CustomerBenefitGrantFeatureFlagUpdate
  | CustomerBenefitGrantSlackSharedChannelUpdate;
/**
 * CustomerCreate
 */
export type CustomerCreate = CustomerIndividualCreate | CustomerTeamCreate;
/**
 * CustomerSubscriptionUpdate
 */
export type CustomerSubscriptionUpdate =
  | CustomerSubscriptionUpdateProduct
  | CustomerSubscriptionUpdateSeats
  | CustomerSubscriptionCancel
  | CustomerSubscriptionUpdateClear;
/**
 * DiscountCreate
 */
export type DiscountCreate = DiscountFixedCreate | DiscountPercentageCreate;
/**
 * FileCreate
 */
export type FileCreate =
  | DownloadableFileCreate
  | ProductMediaFileCreate
  | OrganizationAvatarFileCreate
  | SupportCaseAttachmentFileCreate;
/**
 * MetadataQuery
 */
export type MetadataQuery = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[]
> | null;
/**
 * ProductCreate
 */
export type ProductCreate = ProductCreateRecurring | ProductCreateOneTime;
/**
 * SubscriptionUpdate
 */
export type SubscriptionUpdate =
  | SubscriptionUpdateBase
  | SubscriptionUpdateSeats
  | SubscriptionUpdateBillingPeriod
  | SubscriptionCancel
  | SubscriptionRevoke
  | SubscriptionUpdateClear;
