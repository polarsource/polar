package provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"unicode"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/setvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	_ resource.Resource                = (*organizationResource)(nil)
	_ resource.ResourceWithConfigure   = (*organizationResource)(nil)
	_ resource.ResourceWithImportState = (*organizationResource)(nil)
)

// The server concedes disputes below this amount at most (see
// DISPUTE_AUTO_ACCEPT_MAX_AMOUNT).
const organizationDisputeAutoAcceptMaxAmount = 10_000

func NewOrganizationResource() resource.Resource {
	return &organizationResource{}
}

type organizationResource struct {
	client *polarapi.Client
}

// attributeSource is the part of tfsdk.Plan, tfsdk.State and tfsdk.Config that
// organizationPriorWebsite needs.
type attributeSource interface {
	GetAttribute(ctx context.Context, path path.Path, target any) diag.Diagnostics
}

// organizationPriorWebsite reads the website a plan — or, when refreshing, the
// prior state — carries, which decides how the applied value is spelled. It is
// read on its own rather than with Get: on create every computed attribute the
// configuration leaves out is unknown, and an unknown object has no Go
// representation, which the framework turns into an error blaming the provider.
func organizationPriorWebsite(ctx context.Context, source attributeSource, diags *diag.Diagnostics) types.String {
	var website types.String
	diags.Append(source.GetAttribute(ctx, path.Root("website"), &website)...)
	return website
}

type organizationSubscriptionSettingsModel struct {
	AllowMultipleSubscriptions   types.Bool   `tfsdk:"allow_multiple_subscriptions"`
	ProrationBehavior            types.String `tfsdk:"proration_behavior"`
	BenefitRevocationGracePeriod types.Int64  `tfsdk:"benefit_revocation_grace_period"`
}

type organizationCustomerEmailSettingsModel struct {
	OrderConfirmation                   types.Bool `tfsdk:"order_confirmation"`
	PaymentMethodExpirationReminder     types.Bool `tfsdk:"payment_method_expiration_reminder"`
	SubscriptionCancellation            types.Bool `tfsdk:"subscription_cancellation"`
	SubscriptionConfirmation            types.Bool `tfsdk:"subscription_confirmation"`
	SubscriptionCycled                  types.Bool `tfsdk:"subscription_cycled"`
	SubscriptionCycledAfterTrial        types.Bool `tfsdk:"subscription_cycled_after_trial"`
	SubscriptionPastDue                 types.Bool `tfsdk:"subscription_past_due"`
	SubscriptionPaused                  types.Bool `tfsdk:"subscription_paused"`
	SubscriptionResumed                 types.Bool `tfsdk:"subscription_resumed"`
	SubscriptionRenewalReminder         types.Bool `tfsdk:"subscription_renewal_reminder"`
	SubscriptionRevoked                 types.Bool `tfsdk:"subscription_revoked"`
	SubscriptionTrialConversionReminder types.Bool `tfsdk:"subscription_trial_conversion_reminder"`
	SubscriptionUncanceled              types.Bool `tfsdk:"subscription_uncanceled"`
	SubscriptionUpdated                 types.Bool `tfsdk:"subscription_updated"`
}

type organizationCustomerPortalUsageModel struct {
	Show types.Bool `tfsdk:"show"`
}

type organizationCustomerPortalSubscriptionModel struct {
	UpdateSeats types.Bool `tfsdk:"update_seats"`
	UpdatePlan  types.Bool `tfsdk:"update_plan"`
	Pause       types.Bool `tfsdk:"pause"`
}

type organizationCustomerPortalCustomerModel struct {
	AllowEmailChange types.Bool `tfsdk:"allow_email_change"`
}

type organizationCustomerPortalSettingsModel struct {
	Usage        *organizationCustomerPortalUsageModel        `tfsdk:"usage"`
	Subscription *organizationCustomerPortalSubscriptionModel `tfsdk:"subscription"`
	Customer     *organizationCustomerPortalCustomerModel     `tfsdk:"customer"`
}

type organizationDisputeSettingsModel struct {
	AutoAcceptBelowAmount types.Int64 `tfsdk:"auto_accept_below_amount"`
}

type organizationFeatureSettingsModel struct {
	SeatBasedPricingEnabled     types.Bool `tfsdk:"seat_based_pricing_enabled"`
	MemberModelEnabled          types.Bool `tfsdk:"member_model_enabled"`
	CheckoutLocalizationEnabled types.Bool `tfsdk:"checkout_localization_enabled"`
	OverviewMetrics             types.List `tfsdk:"overview_metrics"`
}

type organizationModel struct {
	ID                         types.String                             `tfsdk:"id"`
	Slug                       types.String                             `tfsdk:"slug"`
	Status                     types.String                             `tfsdk:"status"`
	CreatedAt                  types.String                             `tfsdk:"created_at"`
	Name                       types.String                             `tfsdk:"name"`
	Email                      types.String                             `tfsdk:"email"`
	Website                    types.String                             `tfsdk:"website"`
	EmbedHosts                 types.Set                                `tfsdk:"embed_hosts"`
	DefaultPresentmentCurrency types.String                             `tfsdk:"default_presentment_currency"`
	DefaultTaxBehavior         types.String                             `tfsdk:"default_tax_behavior"`
	SubscriptionSettings       *organizationSubscriptionSettingsModel   `tfsdk:"subscription_settings"`
	CustomerEmailSettings      *organizationCustomerEmailSettingsModel  `tfsdk:"customer_email_settings"`
	CustomerPortalSettings     *organizationCustomerPortalSettingsModel `tfsdk:"customer_portal_settings"`
	DisputeSettings            *organizationDisputeSettingsModel        `tfsdk:"dispute_settings"`
	FeatureSettings            *organizationFeatureSettingsModel        `tfsdk:"feature_settings"`
}

func (r *organizationResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_organization"
}

// organizationCustomerEmails names every customer email the organization can
// switch off, mirroring the server's `OrganizationCustomerEmailSettings`.
var organizationCustomerEmails = map[string]string{
	"order_confirmation":                     "Receipt sent after a successful order.",
	"payment_method_expiration_reminder":     "Warning sent before a saved card expires.",
	"subscription_cancellation":              "Confirmation that a subscription was cancelled.",
	"subscription_confirmation":              "Welcome email sent when a subscription starts.",
	"subscription_cycled":                    "Notice sent when a subscription renews for a new period.",
	"subscription_cycled_after_trial":        "Notice sent when a subscription renews after its trial.",
	"subscription_past_due":                  "Notice sent when a renewal payment fails.",
	"subscription_paused":                    "Notice sent when a subscription is paused.",
	"subscription_resumed":                   "Notice sent when a paused subscription resumes.",
	"subscription_renewal_reminder":          "Reminder sent ahead of a renewal.",
	"subscription_revoked":                   "Notice sent when a subscription's benefits are revoked.",
	"subscription_trial_conversion_reminder": "Reminder sent before a trial converts to a paid subscription.",
	"subscription_uncanceled":                "Notice sent when a scheduled cancellation is undone.",
	"subscription_updated":                   "Notice sent when a subscription's plan or seats change.",
}

func organizationCustomerEmailAttributes() map[string]schema.Attribute {
	attributes := make(map[string]schema.Attribute, len(organizationCustomerEmails))
	for name, description := range organizationCustomerEmails {
		attributes[name] = schema.BoolAttribute{
			MarkdownDescription: description,
			Optional:            true,
			Computed:            true,
		}
	}
	return attributes
}

func (r *organizationResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "The organization the provider's access token belongs to, and its settings. " +
			"This resource is **update-only**: Polar's API cannot create an organization (only a user " +
			"session can) and cannot delete one (deletion is a support-assisted request), so creating this " +
			"resource *adopts* the token's organization and destroying it only forgets it — the organization " +
			"and every setting on it are left exactly as they are.\n\n" +
			"An access token *is* its organization, so there is one organization per provider configuration: " +
			"a second `polar_organization` resource on the same provider would manage the same organization " +
			"and the two would fight. Use a provider alias per organization instead.\n\n" +
			"Only the settings the configuration declares are managed. Every other setting keeps its " +
			"dashboard value and never shows up as drift — which also means removing an attribute stops " +
			"managing it rather than clearing it. To clear a value, change it in the dashboard (or, for " +
			"`embed_hosts`, declare an empty collection).\n\n" +
			"Branding — the organization's avatar and its social profile links — is deliberately not " +
			"managed here; it belongs in the dashboard.\n\n" +
			"Applying the first change to an organization that has never been updated stamps its " +
			"`onboarded_at` server-side, which retires the dashboard's onboarding flow.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization, discovered from the access token.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"slug": schema.StringAttribute{
				MarkdownDescription: "The organization's slug, used in checkout, the customer portal and on " +
					"credit card statements. Chosen when the organization is created and immutable afterwards, " +
					"so it is read-only here.",
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"status": schema.StringAttribute{
				MarkdownDescription: "The organization's review status, e.g. `created`, `under_review`, " +
					"`active` or `denied`. Set by Polar as the organization is reviewed.",
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the organization.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				MarkdownDescription: "The organization name shown in checkout, the customer portal and emails. " +
					"At least 3 characters.",
				Optional: true,
				Computed: true,
				Validators: []validator.String{
					stringvalidator.LengthAtLeast(3),
				},
			},
			"email": schema.StringAttribute{
				MarkdownDescription: "Public support email, shown to customers. The API checks that the " +
					"domain resolves and accepts mail, so a domain without MX records is rejected.",
				Optional: true,
				Computed: true,
			},
			"website": schema.StringAttribute{
				MarkdownDescription: "The organization's official website. Stored normalized (lowercase host, " +
					"trailing slash on a bare domain); an equivalent spelling is kept as written.",
				Optional: true,
				Computed: true,
			},
			"embed_hosts": schema.SetAttribute{
				MarkdownDescription: "Hosts allowed to embed this organization's checkout. An entry is a host " +
					"and an optional port, without a scheme: HTTPS is always allowed, and HTTP too for local " +
					"hosts. `*.example.com` matches any subdomain but not `example.com` itself, and an app " +
					"origin such as `chrome-extension://abcdef` carries its scheme. A set, because the API " +
					"deduplicates the list it is given. Declare an empty set to remove them all.",
				Optional:    true,
				Computed:    true,
				ElementType: types.StringType,
				Validators: []validator.Set{
					setvalidator.ValueStringsAre(embedHost()),
				},
			},
			"default_presentment_currency": schema.StringAttribute{
				MarkdownDescription: "Lowercase ISO 4217 currency customers are charged in when their own " +
					"currency is not available, `usd` by default. The API rejects a change unless every " +
					"active product already has a price in the new currency.",
				Optional: true,
				Computed: true,
				Validators: []validator.String{
					stringvalidator.RegexMatches(currencyRegex, "must be a lowercase three-letter currency code, e.g. usd"),
				},
			},
			"default_tax_behavior": schema.StringAttribute{
				MarkdownDescription: "Whether new product prices are `inclusive` or `exclusive` of tax, or " +
					"determined by the customer's `location` (the default). Existing prices keep the behavior " +
					"they were created with.",
				Optional: true,
				Computed: true,
				Validators: []validator.String{
					stringvalidator.OneOf("location", "inclusive", "exclusive"),
				},
			},
			"subscription_settings": schema.SingleNestedAttribute{
				MarkdownDescription: "How subscriptions behave for this organization.",
				Optional:            true,
				Computed:            true,
				Attributes: map[string]schema.Attribute{
					"allow_multiple_subscriptions": schema.BoolAttribute{
						MarkdownDescription: "Whether a customer may hold several subscriptions to the same product.",
						Optional:            true,
						Computed:            true,
					},
					"proration_behavior": schema.StringAttribute{
						MarkdownDescription: "How a subscription change is billed: `prorate` adds prorations to " +
							"the next invoice, `invoice` bills them immediately, `next_period` applies the new " +
							"price at the next renewal without prorations. `reset` — invoice the new plan in " +
							"full and restart the billing cycle — is only accepted for organizations Polar has " +
							"enabled it for.",
						Optional: true,
						Computed: true,
						Validators: []validator.String{
							stringvalidator.OneOf("invoice", "prorate", "next_period", "reset"),
						},
					},
					"benefit_revocation_grace_period": schema.Int64Attribute{
						MarkdownDescription: "Days a revoked subscription's benefits stay granted after it ends.",
						Optional:            true,
						Computed:            true,
						Validators:          []validator.Int64{int64validator.AtLeast(0)},
					},
				},
			},
			"customer_email_settings": schema.SingleNestedAttribute{
				MarkdownDescription: "Which transactional emails Polar sends this organization's customers.",
				Optional:            true,
				Computed:            true,
				Attributes:          organizationCustomerEmailAttributes(),
			},
			"customer_portal_settings": schema.SingleNestedAttribute{
				MarkdownDescription: "What customers can see and do in the customer portal.",
				Optional:            true,
				Computed:            true,
				Attributes: map[string]schema.Attribute{
					"usage": schema.SingleNestedAttribute{
						MarkdownDescription: "Usage-based billing in the portal.",
						Optional:            true,
						Computed:            true,
						Attributes: map[string]schema.Attribute{
							"show": schema.BoolAttribute{
								MarkdownDescription: "Whether metered usage is shown to the customer.",
								Optional:            true,
								Computed:            true,
							},
						},
					},
					"subscription": schema.SingleNestedAttribute{
						MarkdownDescription: "What a customer may change about their own subscription.",
						Optional:            true,
						Computed:            true,
						Attributes: map[string]schema.Attribute{
							"update_seats": schema.BoolAttribute{
								MarkdownDescription: "Whether the customer can change their seat count.",
								Optional:            true,
								Computed:            true,
							},
							"update_plan": schema.BoolAttribute{
								MarkdownDescription: "Whether the customer can switch to another product.",
								Optional:            true,
								Computed:            true,
							},
							"pause": schema.BoolAttribute{
								MarkdownDescription: "Whether the customer can pause their subscription. " +
									"Absent on organizations that never set it, which reads back as null.",
								Optional: true,
								Computed: true,
							},
						},
					},
					"customer": schema.SingleNestedAttribute{
						MarkdownDescription: "What a customer may change about their own record.",
						Optional:            true,
						Computed:            true,
						Attributes: map[string]schema.Attribute{
							"allow_email_change": schema.BoolAttribute{
								MarkdownDescription: "Whether the customer can change their email address. " +
									"Absent on organizations that never set it, which reads back as null.",
								Optional: true,
								Computed: true,
							},
						},
					},
				},
			},
			"dispute_settings": schema.SingleNestedAttribute{
				MarkdownDescription: "How Polar handles disputes on this organization's behalf.",
				Optional:            true,
				Computed:            true,
				Attributes: map[string]schema.Attribute{
					"auto_accept_below_amount": schema.Int64Attribute{
						MarkdownDescription: "Concede disputes below this amount, in USD cents, without asking. " +
							"The disputed amount and the processor's fee are still deducted. Requires the " +
							"dispute auto-accept feature, which only Polar can enable; the API rejects the " +
							"update with a 403 otherwise. Removing the attribute stops managing it rather than " +
							"turning it off — set it to a lower amount, or turn it off in the dashboard.",
						Optional:   true,
						Computed:   true,
						Validators: []validator.Int64{int64validator.Between(1, organizationDisputeAutoAcceptMaxAmount)},
					},
				},
			},
			"feature_settings": schema.SingleNestedAttribute{
				MarkdownDescription: "The features an organization can turn on itself. Every other feature " +
					"setting is managed by Polar staff: the API silently keeps those, so they are neither " +
					"read nor written here.",
				Optional: true,
				Computed: true,
				Attributes: map[string]schema.Attribute{
					"seat_based_pricing_enabled": schema.BoolAttribute{
						MarkdownDescription: "Whether products may carry seat-based prices. Requires " +
							"`member_model_enabled`, and the API refuses to turn it back off once it is on: " +
							"a configuration that flips it to `false` fails at apply time.",
						Optional: true,
						Computed: true,
					},
					"member_model_enabled": schema.BoolAttribute{
						MarkdownDescription: "Whether customers are modelled as members of a customer account. " +
							"Turning it on backfills existing customers in the background.",
						Optional: true,
						Computed: true,
					},
					"checkout_localization_enabled": schema.BoolAttribute{
						MarkdownDescription: "Whether checkout is translated into the customer's language.",
						Optional:            true,
						Computed:            true,
					},
					"overview_metrics": schema.ListAttribute{
						MarkdownDescription: "Metric slugs shown on the dashboard overview, in display order. " +
							"The API ignores an explicit null (it cannot be cleared through the API), so " +
							"declare an empty list to show none.",
						Optional:    true,
						Computed:    true,
						ElementType: types.StringType,
					},
				},
			},
		},
	}
}

func (r *organizationResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

// Create adopts the organization the access token belongs to — Polar's API has
// no organization creation for a token subject — and applies the settings the
// configuration declares.
func (r *organizationResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var config organizationModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	priorWebsite := organizationPriorWebsite(ctx, req.Plan, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	organization, err := r.adopt(ctx)
	if err != nil {
		resp.Diagnostics.AddError("Failed to resolve the organization", err.Error())
		return
	}

	organization, ok := r.apply(ctx, organization, &config, &resp.Diagnostics)
	if !ok {
		return
	}

	model, diags := organizationToModel(ctx, organization, priorWebsite)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *organizationResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var id types.String
	resp.Diagnostics.Append(req.State.GetAttribute(ctx, path.Root("id"), &id)...)
	priorWebsite := organizationPriorWebsite(ctx, req.State, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	organization, err := r.client.GetOrganization(ctx, id.ValueString())
	if err != nil {
		// The API answers 404 for an organization the token cannot see, which
		// is what a rotated token pointing at another organization looks like:
		// drop it from state so the next apply adopts the new one.
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read organization", err.Error())
		return
	}

	model, diags := organizationToModel(ctx, organization, priorWebsite)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *organizationResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var config organizationModel
	var id types.String
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	resp.Diagnostics.Append(req.State.GetAttribute(ctx, path.Root("id"), &id)...)
	priorWebsite := organizationPriorWebsite(ctx, req.Plan, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	// The settings objects the server replaces wholesale have to be sent
	// complete, so the payload is merged over what the organization currently
	// stores rather than over Terraform's state, which a `-refresh=false` plan
	// leaves stale.
	organization, err := r.client.GetOrganization(ctx, id.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Failed to read organization", err.Error())
		return
	}

	organization, ok := r.apply(ctx, organization, &config, &resp.Diagnostics)
	if !ok {
		return
	}

	model, diags := organizationToModel(ctx, organization, priorWebsite)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

// Delete forgets the organization. Polar's organization deletion is a
// support-assisted request behind a user-only endpoint, and deleting the
// organization is never what removing a settings resource should mean: nothing
// is called, and the organization keeps every setting Terraform applied.
func (r *organizationResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
}

func (r *organizationResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// adopt resolves the organization the access token belongs to. An organization
// access token can only ever see its own organization, so the list endpoint
// returns exactly one.
func (r *organizationResource) adopt(ctx context.Context) (*polarapi.Organization, error) {
	organizations, total, err := r.client.ListOrganizations(ctx, 2)
	if err != nil {
		return nil, err
	}
	if len(organizations) == 1 && total == 1 {
		return &organizations[0], nil
	}
	if total == 0 {
		return nil, fmt.Errorf(
			"the access token has access to no organization; polar_organization manages the organization " +
				"its token belongs to, so configure the provider with an organization access token",
		)
	}
	return nil, fmt.Errorf(
		"the access token has access to %d organizations, so polar_organization cannot tell which one to "+
			"manage; configure the provider with an organization access token, which is bound to exactly one",
		total,
	)
}

// apply sends the settings the configuration declares, merged over what the
// organization currently stores. It reports whether the caller should carry on.
func (r *organizationResource) apply(
	ctx context.Context,
	organization *polarapi.Organization,
	config *organizationModel,
	diags *diag.Diagnostics,
) (*polarapi.Organization, bool) {
	update, updateDiags := organizationUpdateFromConfig(ctx, config, organization)
	diags.Append(updateDiags...)
	if diags.HasError() {
		return nil, false
	}
	// An empty update is not a no-op server-side: the first update of an
	// organization stamps its onboarded_at.
	if update.IsEmpty() {
		return organization, true
	}

	updated, err := r.client.UpdateOrganization(ctx, organization.ID, update)
	if err != nil {
		diags.AddError("Failed to update organization", organizationErrorMessage(err))
		return nil, false
	}
	return updated, true
}

// organizationErrorMessage adds the context the API leaves implicit around the
// rules a Terraform user is most likely to hit.
func organizationErrorMessage(err error) string {
	message := err.Error()
	apiErr, ok := err.(*polarapi.APIError)
	if !ok {
		return message
	}
	switch {
	case strings.Contains(apiErr.Detail, "Seat-based pricing cannot be disabled"):
		message += "\n\nSeat-based pricing is a one-way switch. Remove the attribute from the configuration " +
			"to stop managing it; the organization keeps it enabled."
	case strings.Contains(apiErr.Detail, "Member model must be enabled"):
		message += "\n\nSet feature_settings.member_model_enabled to true in the same apply."
	case strings.Contains(apiErr.Detail, "All active products must have prices in the new currency"):
		message += "\n\nAdd a price in the new currency to every active product first — including the ones " +
			"this configuration does not manage."
	case apiErr.StatusCode == http.StatusForbidden && strings.Contains(apiErr.Detail, "dispute"):
		message += "\n\nAsk Polar to enable dispute auto-accept for the organization before setting " +
			"dispute_settings.auto_accept_below_amount."
	}
	return message
}

// organizationUpdateFromConfig builds the PATCH payload from the configuration
// alone: a key is sent only for an attribute the configuration declares, so
// settings managed outside Terraform are never overwritten.
//
// The three settings objects the server replaces wholesale rather than merging
// — subscription, customer email and customer portal settings — carry every key,
// so the ones the configuration leaves out are filled from `current`.
func organizationUpdateFromConfig(
	ctx context.Context, config *organizationModel, current *polarapi.Organization,
) (polarapi.OrganizationUpdate, diag.Diagnostics) {
	var diags diag.Diagnostics
	update := polarapi.OrganizationUpdate{
		Name:                       stringPointer(config.Name),
		Email:                      stringPointer(config.Email),
		Website:                    stringPointer(config.Website),
		DefaultPresentmentCurrency: stringPointer(config.DefaultPresentmentCurrency),
		DefaultTaxBehavior:         stringPointer(config.DefaultTaxBehavior),
	}

	if !config.EmbedHosts.IsNull() && !config.EmbedHosts.IsUnknown() {
		hosts := []string{}
		diags.Append(config.EmbedHosts.ElementsAs(ctx, &hosts, false)...)
		if diags.HasError() {
			return update, diags
		}
		update.EmbedHosts = &hosts
	}

	if settings := config.SubscriptionSettings; settings != nil {
		update.SubscriptionSettings = &polarapi.OrganizationSubscriptionSettings{
			AllowMultipleSubscriptions: boolOr(
				settings.AllowMultipleSubscriptions, current.SubscriptionSettings.AllowMultipleSubscriptions),
			ProrationBehavior: stringOr(
				settings.ProrationBehavior, current.SubscriptionSettings.ProrationBehavior),
			BenefitRevocationGracePeriod: int64Or(
				settings.BenefitRevocationGracePeriod, current.SubscriptionSettings.BenefitRevocationGracePeriod),
			// Neither is exposed as an attribute, but the server's schema
			// requires both: keep what the organization already stores.
			PreventTrialAbuse:    current.SubscriptionSettings.PreventTrialAbuse,
			AllowCustomerUpdates: current.SubscriptionSettings.AllowCustomerUpdates,
		}
	}

	if settings := config.CustomerEmailSettings; settings != nil {
		update.CustomerEmailSettings = organizationCustomerEmailSettingsToAPI(
			settings, current.CustomerEmailSettings)
	}

	if settings := config.CustomerPortalSettings; settings != nil {
		update.CustomerPortalSettings = organizationCustomerPortalSettingsToAPI(
			settings, current.CustomerPortalSettings)
	}

	if settings := config.DisputeSettings; settings != nil {
		update.DisputeSettings = &polarapi.OrganizationDisputeSettingsUpdate{
			AutoAcceptBelowAmount: int64Pointer(settings.AutoAcceptBelowAmount),
		}
	}

	if settings := config.FeatureSettings; settings != nil {
		featureSettings := polarapi.OrganizationFeatureSettingsUpdate{
			SeatBasedPricingEnabled:     boolPointer(settings.SeatBasedPricingEnabled),
			MemberModelEnabled:          boolPointer(settings.MemberModelEnabled),
			CheckoutLocalizationEnabled: boolPointer(settings.CheckoutLocalizationEnabled),
		}
		if !settings.OverviewMetrics.IsNull() && !settings.OverviewMetrics.IsUnknown() {
			metrics := []string{}
			diags.Append(settings.OverviewMetrics.ElementsAs(ctx, &metrics, false)...)
			if diags.HasError() {
				return update, diags
			}
			featureSettings.OverviewMetrics = &metrics
		}
		update.FeatureSettings = &featureSettings
	}

	return update, diags
}

func organizationCustomerEmailSettingsToAPI(
	settings *organizationCustomerEmailSettingsModel,
	current polarapi.OrganizationCustomerEmailSettings,
) *polarapi.OrganizationCustomerEmailSettings {
	return &polarapi.OrganizationCustomerEmailSettings{
		OrderConfirmation: boolOr(settings.OrderConfirmation, current.OrderConfirmation),
		PaymentMethodExpirationReminder: boolOr(
			settings.PaymentMethodExpirationReminder, current.PaymentMethodExpirationReminder),
		SubscriptionCancellation: boolOr(settings.SubscriptionCancellation, current.SubscriptionCancellation),
		SubscriptionConfirmation: boolOr(settings.SubscriptionConfirmation, current.SubscriptionConfirmation),
		SubscriptionCycled:       boolOr(settings.SubscriptionCycled, current.SubscriptionCycled),
		SubscriptionCycledAfterTrial: boolOr(
			settings.SubscriptionCycledAfterTrial, current.SubscriptionCycledAfterTrial),
		SubscriptionPastDue:         boolOr(settings.SubscriptionPastDue, current.SubscriptionPastDue),
		SubscriptionPaused:          boolOr(settings.SubscriptionPaused, current.SubscriptionPaused),
		SubscriptionResumed:         boolOr(settings.SubscriptionResumed, current.SubscriptionResumed),
		SubscriptionRenewalReminder: boolOr(settings.SubscriptionRenewalReminder, current.SubscriptionRenewalReminder),
		SubscriptionRevoked:         boolOr(settings.SubscriptionRevoked, current.SubscriptionRevoked),
		SubscriptionTrialConversionReminder: boolOr(
			settings.SubscriptionTrialConversionReminder, current.SubscriptionTrialConversionReminder),
		SubscriptionUncanceled: boolOr(settings.SubscriptionUncanceled, current.SubscriptionUncanceled),
		SubscriptionUpdated:    boolOr(settings.SubscriptionUpdated, current.SubscriptionUpdated),
	}
}

func organizationCustomerPortalSettingsToAPI(
	settings *organizationCustomerPortalSettingsModel,
	current polarapi.OrganizationCustomerPortalSettings,
) *polarapi.OrganizationCustomerPortalSettings {
	portal := current
	if settings.Usage != nil {
		portal.Usage.Show = boolOr(settings.Usage.Show, current.Usage.Show)
	}
	if settings.Subscription != nil {
		portal.Subscription.UpdateSeats = boolOr(settings.Subscription.UpdateSeats, current.Subscription.UpdateSeats)
		portal.Subscription.UpdatePlan = boolOr(settings.Subscription.UpdatePlan, current.Subscription.UpdatePlan)
		portal.Subscription.Pause = boolPointerOr(settings.Subscription.Pause, current.Subscription.Pause)
	}
	if settings.Customer != nil {
		customer := polarapi.OrganizationCustomerPortalCustomerSettings{}
		if current.Customer != nil {
			customer = *current.Customer
		}
		customer.AllowEmailChange = boolPointerOr(settings.Customer.AllowEmailChange, customer.AllowEmailChange)
		portal.Customer = &customer
	}
	return &portal
}

func organizationToModel(
	ctx context.Context, organization *polarapi.Organization, priorWebsite types.String,
) (organizationModel, diag.Diagnostics) {
	var diags diag.Diagnostics

	embedHosts, hostDiags := types.SetValueFrom(ctx, types.StringType, organization.EmbedHosts)
	diags.Append(hostDiags...)

	featureSettings, featureDiags := organizationFeatureSettingsFromAPI(ctx, organization.FeatureSettings)
	diags.Append(featureDiags...)
	if diags.HasError() {
		return organizationModel{}, diags
	}

	return organizationModel{
		ID:                         types.StringValue(organization.ID),
		Slug:                       types.StringValue(organization.Slug),
		Status:                     types.StringValue(organization.Status),
		CreatedAt:                  types.StringValue(organization.CreatedAt),
		Name:                       types.StringValue(organization.Name),
		Email:                      stringFromPointer(organization.Email),
		Website:                    keepEquivalentURL(priorWebsite, organization.Website),
		EmbedHosts:                 embedHosts,
		DefaultPresentmentCurrency: types.StringValue(organization.DefaultPresentmentCurrency),
		DefaultTaxBehavior:         types.StringValue(organization.DefaultTaxBehavior),
		SubscriptionSettings: &organizationSubscriptionSettingsModel{
			AllowMultipleSubscriptions:   types.BoolValue(organization.SubscriptionSettings.AllowMultipleSubscriptions),
			ProrationBehavior:            types.StringValue(organization.SubscriptionSettings.ProrationBehavior),
			BenefitRevocationGracePeriod: types.Int64Value(organization.SubscriptionSettings.BenefitRevocationGracePeriod),
		},
		CustomerEmailSettings:  organizationCustomerEmailSettingsFromAPI(organization.CustomerEmailSettings),
		CustomerPortalSettings: organizationCustomerPortalSettingsFromAPI(organization.CustomerPortalSettings),
		DisputeSettings: &organizationDisputeSettingsModel{
			AutoAcceptBelowAmount: int64FromPointer(organization.DisputeSettings.AutoAcceptBelowAmount),
		},
		FeatureSettings: featureSettings,
	}, diags
}

func organizationCustomerEmailSettingsFromAPI(
	settings polarapi.OrganizationCustomerEmailSettings,
) *organizationCustomerEmailSettingsModel {
	return &organizationCustomerEmailSettingsModel{
		OrderConfirmation:                   types.BoolValue(settings.OrderConfirmation),
		PaymentMethodExpirationReminder:     types.BoolValue(settings.PaymentMethodExpirationReminder),
		SubscriptionCancellation:            types.BoolValue(settings.SubscriptionCancellation),
		SubscriptionConfirmation:            types.BoolValue(settings.SubscriptionConfirmation),
		SubscriptionCycled:                  types.BoolValue(settings.SubscriptionCycled),
		SubscriptionCycledAfterTrial:        types.BoolValue(settings.SubscriptionCycledAfterTrial),
		SubscriptionPastDue:                 types.BoolValue(settings.SubscriptionPastDue),
		SubscriptionPaused:                  types.BoolValue(settings.SubscriptionPaused),
		SubscriptionResumed:                 types.BoolValue(settings.SubscriptionResumed),
		SubscriptionRenewalReminder:         types.BoolValue(settings.SubscriptionRenewalReminder),
		SubscriptionRevoked:                 types.BoolValue(settings.SubscriptionRevoked),
		SubscriptionTrialConversionReminder: types.BoolValue(settings.SubscriptionTrialConversionReminder),
		SubscriptionUncanceled:              types.BoolValue(settings.SubscriptionUncanceled),
		SubscriptionUpdated:                 types.BoolValue(settings.SubscriptionUpdated),
	}
}

func organizationCustomerPortalSettingsFromAPI(
	settings polarapi.OrganizationCustomerPortalSettings,
) *organizationCustomerPortalSettingsModel {
	model := &organizationCustomerPortalSettingsModel{
		Usage: &organizationCustomerPortalUsageModel{
			Show: types.BoolValue(settings.Usage.Show),
		},
		Subscription: &organizationCustomerPortalSubscriptionModel{
			UpdateSeats: types.BoolValue(settings.Subscription.UpdateSeats),
			UpdatePlan:  types.BoolValue(settings.Subscription.UpdatePlan),
			Pause:       boolFromPointer(settings.Subscription.Pause),
		},
	}
	// The customer sub-object is optional server-side and absent on
	// organizations that never set it.
	if settings.Customer != nil {
		model.Customer = &organizationCustomerPortalCustomerModel{
			AllowEmailChange: boolFromPointer(settings.Customer.AllowEmailChange),
		}
	}
	return model
}

func organizationFeatureSettingsFromAPI(
	ctx context.Context, settings *polarapi.OrganizationFeatureSettings,
) (*organizationFeatureSettingsModel, diag.Diagnostics) {
	var diags diag.Diagnostics
	if settings == nil {
		return nil, diags
	}
	overviewMetrics := types.ListNull(types.StringType)
	if settings.OverviewMetrics != nil {
		list, listDiags := types.ListValueFrom(ctx, types.StringType, settings.OverviewMetrics)
		diags.Append(listDiags...)
		overviewMetrics = list
	}
	return &organizationFeatureSettingsModel{
		SeatBasedPricingEnabled:     types.BoolValue(settings.SeatBasedPricingEnabled),
		MemberModelEnabled:          types.BoolValue(settings.MemberModelEnabled),
		CheckoutLocalizationEnabled: types.BoolValue(settings.CheckoutLocalizationEnabled),
		OverviewMetrics:             overviewMetrics,
	}, diags
}

// embedHost rejects the entries the API would rewrite before storing. The
// allowlist is normalized server-side — trimmed, lowercased, punycoded, and
// stripped of a redundant `:443` — and a rewritten entry would never match what
// the configuration asks for.
type embedHostValidator struct{}

func (v embedHostValidator) Description(ctx context.Context) string {
	return "must be a lowercase ASCII host, without surrounding whitespace or a redundant :443 port"
}

func (v embedHostValidator) MarkdownDescription(ctx context.Context) string {
	return v.Description(ctx)
}

func (v embedHostValidator) ValidateString(ctx context.Context, req validator.StringRequest, resp *validator.StringResponse) {
	if req.ConfigValue.IsNull() || req.ConfigValue.IsUnknown() {
		return
	}
	value := req.ConfigValue.ValueString()
	rewritten := func(detail string) {
		resp.Diagnostics.AddAttributeError(req.Path, "Embed host would be rewritten", detail)
	}
	switch {
	case strings.TrimSpace(value) != value:
		rewritten("The API strips surrounding whitespace from an embed host, which would cause a " +
			"permanent diff. Remove it.")
	case value != strings.ToLower(value):
		rewritten(fmt.Sprintf("The API lowercases embed hosts, which would cause a permanent diff. "+
			"Write %q instead.", strings.ToLower(value)))
	case !isASCII(value):
		rewritten("The API stores internationalized hosts in punycode, which would cause a permanent " +
			"diff. Write the punycode form, e.g. xn--caf-dma.com for café.com.")
	case !strings.Contains(value, "://") && strings.HasSuffix(value, ":443"):
		rewritten("HTTPS is implied, so the API drops a :443 port and would leave a permanent diff. " +
			"Write the host on its own.")
	}
}

func embedHost() validator.String {
	return embedHostValidator{}
}

func isASCII(value string) bool {
	for _, character := range value {
		if character > unicode.MaxASCII {
			return false
		}
	}
	return true
}
