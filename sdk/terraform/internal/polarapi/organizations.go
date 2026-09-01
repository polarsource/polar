package polarapi

import (
	"context"
	"net/http"
	"strconv"
)

// OrganizationSubscriptionSettings carries every key of the server's
// `OrganizationSubscriptionSettings` TypedDict, which is total: an update
// missing one is a 422, and the server replaces the whole object rather than
// merging it. The provider therefore reads the organization first and sends the
// stored value for the keys it does not manage.
type OrganizationSubscriptionSettings struct {
	AllowMultipleSubscriptions   bool   `json:"allow_multiple_subscriptions"`
	ProrationBehavior            string `json:"proration_behavior"`
	BenefitRevocationGracePeriod int64  `json:"benefit_revocation_grace_period"`
	PreventTrialAbuse            bool   `json:"prevent_trial_abuse"`
	AllowCustomerUpdates         bool   `json:"allow_customer_updates"`
}

// OrganizationCustomerEmailSettings is total and wholly replaced on update,
// like OrganizationSubscriptionSettings.
type OrganizationCustomerEmailSettings struct {
	OrderConfirmation                   bool `json:"order_confirmation"`
	PaymentMethodExpirationReminder     bool `json:"payment_method_expiration_reminder"`
	SubscriptionCancellation            bool `json:"subscription_cancellation"`
	SubscriptionConfirmation            bool `json:"subscription_confirmation"`
	SubscriptionCycled                  bool `json:"subscription_cycled"`
	SubscriptionCycledAfterTrial        bool `json:"subscription_cycled_after_trial"`
	SubscriptionPastDue                 bool `json:"subscription_past_due"`
	SubscriptionPaused                  bool `json:"subscription_paused"`
	SubscriptionResumed                 bool `json:"subscription_resumed"`
	SubscriptionRenewalReminder         bool `json:"subscription_renewal_reminder"`
	SubscriptionRevoked                 bool `json:"subscription_revoked"`
	SubscriptionTrialConversionReminder bool `json:"subscription_trial_conversion_reminder"`
	SubscriptionUncanceled              bool `json:"subscription_uncanceled"`
	SubscriptionUpdated                 bool `json:"subscription_updated"`
}

type OrganizationCustomerPortalUsageSettings struct {
	Show bool `json:"show"`
}

// Pause is optional in the server's TypedDict and absent on organizations that
// never set it; a pointer keeps "absent" distinct from "false".
type OrganizationCustomerPortalSubscriptionSettings struct {
	UpdateSeats bool  `json:"update_seats"`
	UpdatePlan  bool  `json:"update_plan"`
	Pause       *bool `json:"pause,omitempty"`
}

type OrganizationCustomerPortalCustomerSettings struct {
	AllowEmailChange *bool `json:"allow_email_change,omitempty"`
}

// OrganizationCustomerPortalSettings is replaced wholesale on update, so an
// omitted optional sub-object is dropped from the stored settings rather than
// kept.
type OrganizationCustomerPortalSettings struct {
	Usage        OrganizationCustomerPortalUsageSettings        `json:"usage"`
	Subscription OrganizationCustomerPortalSubscriptionSettings `json:"subscription"`
	Customer     *OrganizationCustomerPortalCustomerSettings    `json:"customer,omitempty"`
}

type OrganizationDisputeSettings struct {
	AutoAcceptBelowAmount *int64 `json:"auto_accept_below_amount"`
}

// OrganizationDisputeSettingsUpdate is merged into the stored dispute settings
// with `exclude_unset`, so omitting the key keeps the stored value.
type OrganizationDisputeSettingsUpdate struct {
	AutoAcceptBelowAmount *int64 `json:"auto_accept_below_amount,omitempty"`
}

// OrganizationFeatureSettings decodes only the four settings an organization
// can change itself. Every other key is managed by Polar staff: the server
// silently ignores them on update and keeps their stored value, so the provider
// never reads or writes them.
type OrganizationFeatureSettings struct {
	SeatBasedPricingEnabled     bool     `json:"seat_based_pricing_enabled"`
	MemberModelEnabled          bool     `json:"member_model_enabled"`
	CheckoutLocalizationEnabled bool     `json:"checkout_localization_enabled"`
	OverviewMetrics             []string `json:"overview_metrics"`
}

// OrganizationFeatureSettingsUpdate is merged key by key into the stored
// feature settings (`exclude_unset` plus `exclude_none`), so every field is a
// pointer: an omitted one keeps its stored value.
type OrganizationFeatureSettingsUpdate struct {
	SeatBasedPricingEnabled     *bool     `json:"seat_based_pricing_enabled,omitempty"`
	MemberModelEnabled          *bool     `json:"member_model_enabled,omitempty"`
	CheckoutLocalizationEnabled *bool     `json:"checkout_localization_enabled,omitempty"`
	OverviewMetrics             *[]string `json:"overview_metrics,omitempty"`
}

// Organization is the API's read shape, narrowed to what the provider manages
// or surfaces. Onboarding, compliance, account and capability fields are
// deliberately not decoded.
type Organization struct {
	ID                         string                             `json:"id"`
	CreatedAt                  string                             `json:"created_at"`
	Name                       string                             `json:"name"`
	Slug                       string                             `json:"slug"`
	Status                     string                             `json:"status"`
	Email                      *string                            `json:"email"`
	Website                    *string                            `json:"website"`
	EmbedHosts                 []string                           `json:"embed_hosts"`
	DefaultPresentmentCurrency string                             `json:"default_presentment_currency"`
	DefaultTaxBehavior         string                             `json:"default_tax_behavior"`
	FeatureSettings            *OrganizationFeatureSettings       `json:"feature_settings"`
	SubscriptionSettings       OrganizationSubscriptionSettings   `json:"subscription_settings"`
	CustomerEmailSettings      OrganizationCustomerEmailSettings  `json:"customer_email_settings"`
	CustomerPortalSettings     OrganizationCustomerPortalSettings `json:"customer_portal_settings"`
	DisputeSettings            OrganizationDisputeSettings        `json:"dispute_settings"`
}

// OrganizationUpdate carries only the settings the configuration declares: the
// server applies the parsed payload with `model_dump(exclude_unset=True)`, so
// an omitted key keeps its stored value and a key present with a null clears
// it. Every field is therefore a pointer with `omitempty`, and the provider
// never sends a key for an attribute the configuration leaves out — undeclared
// settings stay unmanaged.
//
// slug, details (KYC), country, sso_enforced, avatar_url and socials are
// deliberately absent: the slug is immutable, details and country belong to
// onboarding, an organization access token cannot set sso_enforced (the
// endpoint requires an SSO-authenticated user session), and the avatar and
// social links are branding, managed in the dashboard.
type OrganizationUpdate struct {
	Name                       *string                             `json:"name,omitempty"`
	Email                      *string                             `json:"email,omitempty"`
	Website                    *string                             `json:"website,omitempty"`
	EmbedHosts                 *[]string                           `json:"embed_hosts,omitempty"`
	DefaultPresentmentCurrency *string                             `json:"default_presentment_currency,omitempty"`
	DefaultTaxBehavior         *string                             `json:"default_tax_behavior,omitempty"`
	SubscriptionSettings       *OrganizationSubscriptionSettings   `json:"subscription_settings,omitempty"`
	CustomerEmailSettings      *OrganizationCustomerEmailSettings  `json:"customer_email_settings,omitempty"`
	CustomerPortalSettings     *OrganizationCustomerPortalSettings `json:"customer_portal_settings,omitempty"`
	DisputeSettings            *OrganizationDisputeSettingsUpdate  `json:"dispute_settings,omitempty"`
	FeatureSettings            *OrganizationFeatureSettingsUpdate  `json:"feature_settings,omitempty"`
}

// IsEmpty reports whether the update would change nothing. The provider skips
// the request entirely then: the first update of an organization stamps its
// `onboarded_at`, so an empty PATCH is not a no-op server-side.
func (u OrganizationUpdate) IsEmpty() bool {
	return u == OrganizationUpdate{}
}

func (c *Client) GetOrganization(ctx context.Context, id string) (*Organization, error) {
	var organization Organization
	if err := c.do(ctx, http.MethodGet, "/v1/organizations/"+id, nil, &organization); err != nil {
		return nil, err
	}
	return &organization, nil
}

// ListOrganizations returns the organizations the token can see, newest first.
// An organization access token sees exactly one — itself — which is how the
// polar_organization resource adopts it.
func (c *Client) ListOrganizations(ctx context.Context, limit int) ([]Organization, int, error) {
	var page struct {
		Items      []Organization `json:"items"`
		Pagination struct {
			TotalCount int `json:"total_count"`
		} `json:"pagination"`
	}
	path := "/v1/organizations/?limit=" + strconv.Itoa(limit)
	if err := c.do(ctx, http.MethodGet, path, nil, &page); err != nil {
		return nil, 0, err
	}
	return page.Items, page.Pagination.TotalCount, nil
}

func (c *Client) UpdateOrganization(ctx context.Context, id string, update OrganizationUpdate) (*Organization, error) {
	var organization Organization
	if err := c.do(ctx, http.MethodPatch, "/v1/organizations/"+id, update, &organization); err != nil {
		return nil, err
	}
	return &organization, nil
}
