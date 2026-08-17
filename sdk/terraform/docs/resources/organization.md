---
page_title: "polar_organization Resource - polar"
description: |-
  The organization the provider's access token belongs to, and its settings.
---

# polar_organization (Resource)

The organization the provider's access token belongs to, and its settings.

## Adopt on create, forget on destroy

This resource is **update-only**. Polar's API cannot create an organization — only a signed-in
user can, from the dashboard — and cannot delete one either: deletion is a support-assisted
request behind a user-only endpoint. So the lifecycle is not the usual one:

| Terraform | What happens |
| --- | --- |
| `terraform apply` (create) | **Adopts** the organization the access token belongs to, then applies the settings the configuration declares. Nothing is created. |
| `terraform apply` (update) | Applies the declared settings. |
| `terraform destroy` | **Forgets** the organization: the resource leaves state and *nothing at all is called*. The organization and every setting Terraform applied stay exactly as they are. |
| `terraform import` | Reads the organization by ID. Rarely needed — a plain `apply` adopts it. |

An access token *is* its organization, so there is exactly one organization per provider
configuration. Declaring two `polar_organization` resources against the same provider gives you
two resources managing the *same* organization, which will fight over every setting they both
declare. To manage several organizations, configure one provider alias per organization, each
with its own token.

## Only what you declare is managed

Every settable attribute is optional and computed: an attribute the configuration leaves out
keeps whatever the dashboard set and never shows up as drift, and no request the provider makes
mentions it. That is what makes it safe to manage two or three settings in Terraform and the
rest in the dashboard — including the settings objects the API replaces wholesale, which the
provider completes from the organization's current values before sending them.

The flip side: **removing an attribute stops managing it, it does not clear it.** To clear a
value, change it in the dashboard — or, for `socials`, `embed_hosts` and
`feature_settings.overview_metrics`, declare an empty collection, which the API does treat as
"remove them all".

Applying the first change to an organization that has never been updated stamps its
`onboarded_at` server-side, which retires the dashboard's onboarding flow for it.

## Example Usage

```terraform
# The organization this provider's access token belongs to. Creating the
# resource adopts it; destroying the resource only forgets it.
resource "polar_organization" "this" {
  name    = "Acme"
  email   = "support@acme.com"
  website = "https://acme.com/"

  socials = [
    { url = "https://github.com/acme" },
    { url = "https://x.com/acme" },
  ]

  # Hosts allowed to open an embedded checkout.
  embed_hosts = [
    "acme.com",
    "*.acme.com",
    "localhost:3000",
  ]

  default_presentment_currency = "usd"
  default_tax_behavior         = "location"

  subscription_settings = {
    allow_multiple_subscriptions    = false
    proration_behavior              = "prorate"
    benefit_revocation_grace_period = 7
  }

  # Only the toggles named here are managed; the rest keep their dashboard value.
  customer_email_settings = {
    subscription_renewal_reminder = true
  }

  customer_portal_settings = {
    subscription = {
      update_plan  = true
      update_seats = true
    }
  }

  feature_settings = {
    member_model_enabled          = true
    checkout_localization_enabled = true
  }
}

output "organization_slug" {
  value = polar_organization.this.slug
}
```

## Schema

Every attribute below is **Optional and Computed**: declare it to manage it, leave it out to
read it.

### Optional

- `name` (String) The organization name shown in checkout, the customer portal and emails. At
  least 3 characters.
- `email` (String) Public support email, shown to customers. The API checks that the domain
  resolves and accepts mail, so a domain without MX records is rejected.
- `website` (String) The organization's official website. Stored normalized (lowercase host,
  trailing slash on a bare domain); an equivalent spelling is kept as written.
- `avatar_url` (String) URL of the logo shown in checkout, the customer portal and emails.
  Upload the image through the files API or the dashboard first — this only points at it.
  logo.dev URLs are rejected at plan time: the API discards them and stores no avatar.
- `socials` (Attributes List) Links to the organization's social profiles, in display order.
  Declare an empty list to remove them all. See [below](#nestedatt--socials).
- `embed_hosts` (Set of String) Hosts allowed to embed this organization's checkout. An entry
  is a host and an optional port, without a scheme: HTTPS is always allowed, and HTTP too for
  local hosts (`localhost`, any `.localhost` or `.local` name, loopback and private addresses).
  `*.example.com` matches any subdomain but not `example.com` itself, and an app origin such as
  `chrome-extension://abcdef` carries its scheme. A **set**, because the API deduplicates the
  list it is given. Entries the API would rewrite — uppercase, surrounding whitespace, a
  non-ASCII host, a redundant `:443` — are rejected at plan time. Declare an empty set to remove
  them all.
- `default_presentment_currency` (String) Lowercase ISO 4217 currency customers are charged in
  when their own currency is not available, `usd` by default. The API rejects a change unless
  every active product already has a price in the new currency — including products this
  configuration does not manage.
- `default_tax_behavior` (String) Whether new product prices are `inclusive` or `exclusive` of
  tax, or determined by the customer's `location` (the default). Existing prices keep the
  behavior they were created with.
- `subscription_settings` (Attributes) See [below](#nestedatt--subscription_settings).
- `customer_email_settings` (Attributes) See [below](#nestedatt--customer_email_settings).
- `customer_portal_settings` (Attributes) See [below](#nestedatt--customer_portal_settings).
- `dispute_settings` (Attributes) See [below](#nestedatt--dispute_settings).
- `feature_settings` (Attributes) See [below](#nestedatt--feature_settings).

### Read-Only

- `id` (String) The ID of the organization, discovered from the access token.
- `slug` (String) The organization's slug, used in checkout, the customer portal and on credit
  card statements. Chosen when the organization is created and immutable afterwards.
- `status` (String) The organization's review status, e.g. `created`, `under_review`, `active`
  or `denied`. Set by Polar as the organization is reviewed.
- `created_at` (String) Creation timestamp of the organization.

<a id="nestedatt--socials"></a>
### Nested Schema for `socials`

Required:

- `url` (String) The URL of the profile.

Read-Only:

- `platform` (String) The platform the URL points at, e.g. `github`, `x` or `linkedin`, and
  `other` for anything Polar does not recognize. **Derived from the URL by the API**, which
  overwrites whatever a caller sends, so it cannot be set — the provider does not even send it.
  Reordering or replacing a link re-derives it.

<a id="nestedatt--subscription_settings"></a>
### Nested Schema for `subscription_settings`

Optional:

- `allow_multiple_subscriptions` (Boolean) Whether a customer may hold several subscriptions to
  the same product.
- `proration_behavior` (String) How a subscription change is billed: `prorate` adds prorations
  to the next invoice, `invoice` bills them immediately, `next_period` applies the new price at
  the next renewal without prorations. `reset` — invoice the new plan in full and restart the
  billing cycle — is only accepted for organizations Polar has enabled it for.
- `benefit_revocation_grace_period` (Number) Days a revoked subscription's benefits stay granted
  after it ends.

<a id="nestedatt--customer_email_settings"></a>
### Nested Schema for `customer_email_settings`

Which transactional emails Polar sends this organization's customers. All optional booleans:

`order_confirmation`, `payment_method_expiration_reminder`, `subscription_cancellation`,
`subscription_confirmation`, `subscription_cycled`, `subscription_cycled_after_trial`,
`subscription_past_due`, `subscription_paused`, `subscription_renewal_reminder`,
`subscription_resumed`, `subscription_revoked`, `subscription_trial_conversion_reminder`,
`subscription_uncanceled`, `subscription_updated`.

<a id="nestedatt--customer_portal_settings"></a>
### Nested Schema for `customer_portal_settings`

Optional:

- `usage` (Attributes) `show` (Boolean) — whether metered usage is shown to the customer.
- `subscription` (Attributes) `update_seats`, `update_plan` and `pause` (Booleans) — what a
  customer may change about their own subscription. `pause` is absent on organizations that
  never set it, which reads back as null.
- `customer` (Attributes) `allow_email_change` (Boolean) — whether the customer can change their
  email address. Absent on organizations that never set it, which reads back as null.

<a id="nestedatt--dispute_settings"></a>
### Nested Schema for `dispute_settings`

Optional:

- `auto_accept_below_amount` (Number) Concede disputes below this amount, in USD cents (1 to
  10000), without asking. A dispute charged in another currency converts at the rate its payment
  settled at; the disputed amount and the processor's dispute fee are still deducted. **Requires
  the dispute auto-accept feature, which only Polar can enable** — the API answers 403 otherwise.
  Removing the attribute stops managing it rather than turning it off.

<a id="nestedatt--feature_settings"></a>
### Nested Schema for `feature_settings`

The features an organization can turn on itself. Every other feature setting is managed by Polar
staff: the API silently keeps those, so they are neither read nor written here.

Optional:

- `seat_based_pricing_enabled` (Boolean) Whether products may carry seat-based prices. Requires
  `member_model_enabled`, and **the API refuses to turn it back off once it is on** — a
  configuration that flips it to `false` fails at apply time. Organizations created since the
  feature shipped have it on already.
- `member_model_enabled` (Boolean) Whether customers are modelled as members of a customer
  account. Turning it on backfills existing customers in the background.
- `checkout_localization_enabled` (Boolean) Whether checkout is translated into the customer's
  language.
- `overview_metrics` (List of String) Metric slugs shown on the dashboard overview, in display
  order. The API ignores an explicit null, so declare an empty list to show none.

## Not exposed

Some of the organization's fields deliberately have no attribute here:

- **`slug`** is immutable after creation; it is read-only above.
- **`details`** (the compliance/KYC questionnaire) and **`country`** belong to onboarding and
  review, not to infrastructure-as-code. Fill them in the dashboard.
- **`sso_enforced`** cannot be set by an access token at all: the API only accepts it from a
  session already authenticated through the organization's own SSO connection.
- **`notification_settings`** is deprecated — notification preferences are per member now.
- **Staff-managed feature settings** (wallets, disputes, SSO, off-session charges, preview
  access, …) are ignored by the API when a merchant sends them.
- **`account_id`, `payout_account_id`, `capabilities`, `details_submitted_at`, `onboarded_at`**
  are outcomes of onboarding and review rather than settings.

## Import

Importing is rarely necessary: creating the resource adopts the token's organization. Import by
organization ID when you want the resource in state without an apply:

```shell
terraform import polar_organization.this 00000000-0000-0000-0000-000000000000
```
