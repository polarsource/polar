package provider

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/listvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/tfsdk"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	_ resource.Resource                   = (*productResource)(nil)
	_ resource.ResourceWithConfigure      = (*productResource)(nil)
	_ resource.ResourceWithImportState    = (*productResource)(nil)
	_ resource.ResourceWithValidateConfig = (*productResource)(nil)
)

// Billing, meter and trial cycles all share the API's interval enum.
var productIntervals = []string{"day", "week", "month", "year"}

var productPriceAmountTypes = []string{"fixed", "custom", "seat_based", "metered_unit"}

// Attributes of a price that only belong to some amount types, in the order
// their diagnostics should appear.
var productPriceAmountAttributes = []string{
	"price_amount", "minimum_amount", "maximum_amount", "preset_amount",
	"seat_tiers", "meter_id", "unit_amount", "cap_amount",
}

var productPriceAllowedAttributes = map[string][]string{
	"fixed":        {"price_amount"},
	"custom":       {"minimum_amount", "maximum_amount", "preset_amount"},
	"seat_based":   {"seat_tiers"},
	"metered_unit": {"meter_id", "unit_amount", "cap_amount"},
}

var productPriceRequiredAttributes = map[string][]string{
	"fixed":        {"price_amount"},
	"custom":       {"minimum_amount"},
	"seat_based":   {"seat_tiers"},
	"metered_unit": {"meter_id", "unit_amount"},
}

var (
	currencyRegex   = regexp.MustCompile(`^[a-z]{3}$`)
	unitAmountRegex = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?$`)
)

// The API stores metered unit amounts as a decimal(17, 12).
const (
	unitAmountDigits        = 17
	unitAmountDecimalPlaces = 12
)

func NewProductResource() resource.Resource {
	return &productResource{}
}

type productResource struct {
	client *polarapi.Client
}

type productSeatTierModel struct {
	MinSeats     types.Int64 `tfsdk:"min_seats"`
	MaxSeats     types.Int64 `tfsdk:"max_seats"`
	PricePerSeat types.Int64 `tfsdk:"price_per_seat"`
}

type productSeatTiersModel struct {
	SeatTierType types.String           `tfsdk:"seat_tier_type"`
	Tiers        []productSeatTierModel `tfsdk:"tiers"`
}

type productPriceModel struct {
	ID            types.String           `tfsdk:"id"`
	AmountType    types.String           `tfsdk:"amount_type"`
	PriceCurrency types.String           `tfsdk:"price_currency"`
	TaxBehavior   types.String           `tfsdk:"tax_behavior"`
	PriceAmount   types.Int64            `tfsdk:"price_amount"`
	MinimumAmount types.Int64            `tfsdk:"minimum_amount"`
	MaximumAmount types.Int64            `tfsdk:"maximum_amount"`
	PresetAmount  types.Int64            `tfsdk:"preset_amount"`
	SeatTiers     *productSeatTiersModel `tfsdk:"seat_tiers"`
	MeterID       types.String           `tfsdk:"meter_id"`
	UnitAmount    types.String           `tfsdk:"unit_amount"`
	CapAmount     types.Int64            `tfsdk:"cap_amount"`
}

type productCustomFieldModel struct {
	CustomFieldID types.String `tfsdk:"custom_field_id"`
	Required      types.Bool   `tfsdk:"required"`
}

type productModel struct {
	ID                     types.String              `tfsdk:"id"`
	Name                   types.String              `tfsdk:"name"`
	Description            types.String              `tfsdk:"description"`
	Visibility             types.String              `tfsdk:"visibility"`
	RecurringInterval      types.String              `tfsdk:"recurring_interval"`
	RecurringIntervalCount types.Int64               `tfsdk:"recurring_interval_count"`
	MeterInterval          types.String              `tfsdk:"meter_interval"`
	MeterIntervalCount     types.Int64               `tfsdk:"meter_interval_count"`
	TrialInterval          types.String              `tfsdk:"trial_interval"`
	TrialIntervalCount     types.Int64               `tfsdk:"trial_interval_count"`
	Prices                 []productPriceModel       `tfsdk:"prices"`
	Benefits               types.List                `tfsdk:"benefits"`
	AttachedCustomFields   []productCustomFieldModel `tfsdk:"attached_custom_fields"`
	Medias                 types.List                `tfsdk:"medias"`
	Metadata               types.Map                 `tfsdk:"metadata"`
	OrganizationID         types.String              `tfsdk:"organization_id"`
	CreatedAt              types.String              `tfsdk:"created_at"`
}

func productPriceAttributeSchema() map[string]schema.Attribute {
	return map[string]schema.Attribute{
		"id": schema.StringAttribute{
			MarkdownDescription: "The ID of the price. Prices cannot be updated in place: changing any " +
				"attribute of a price archives the old price and creates a new one, so this ID shows as " +
				"`(known after apply)` whenever the price changes.",
			Computed: true,
		},
		"amount_type": schema.StringAttribute{
			MarkdownDescription: "The kind of price: `fixed`, `custom` (pay what you want), `seat_based` " +
				"or `metered_unit`. Set exactly the attributes belonging to this kind. " +
				"A free price is `fixed` with `price_amount = 0`.",
			Required: true,
			Validators: []validator.String{
				stringvalidator.OneOf(productPriceAmountTypes...),
			},
		},
		"price_currency": schema.StringAttribute{
			MarkdownDescription: "Lowercase ISO 4217 currency the customer is charged in, `usd` by default. " +
				"The organization's default presentment currency must be covered by at least one price.",
			Optional: true,
			Computed: true,
			Default:  stringdefault.StaticString("usd"),
			Validators: []validator.String{
				stringvalidator.RegexMatches(currencyRegex, "must be a lowercase three-letter currency code, e.g. usd"),
			},
		},
		"tax_behavior": schema.StringAttribute{
			MarkdownDescription: "Whether the amount is `inclusive` or `exclusive` of tax, or determined by " +
				"the customer's `location`. Defaults to the organization's setting. " +
				"All prices sharing a currency must agree on it.",
			Optional: true,
			Validators: []validator.String{
				stringvalidator.OneOf("location", "inclusive", "exclusive"),
			},
		},
		"price_amount": schema.Int64Attribute{
			MarkdownDescription: "The price in cents for `fixed` prices. `0` makes the product free; any other " +
				"value must clear the currency's minimum charge.",
			Optional:   true,
			Validators: []validator.Int64{int64validator.AtLeast(0)},
		},
		"minimum_amount": schema.Int64Attribute{
			MarkdownDescription: "The lowest amount a customer may pay for a `custom` price, in cents. " +
				"`0` means \"free or pay what you want\". Required for `custom` prices: the API would " +
				"otherwise silently apply its own 50-cent floor.",
			Optional:   true,
			Validators: []validator.Int64{int64validator.AtLeast(0)},
		},
		"maximum_amount": schema.Int64Attribute{
			MarkdownDescription: "The highest amount a customer may pay for a `custom` price, in cents.",
			Optional:            true,
			Validators:          []validator.Int64{int64validator.AtLeast(1)},
		},
		"preset_amount": schema.Int64Attribute{
			MarkdownDescription: "The amount shown to the customer by default for a `custom` price, in cents.",
			Optional:            true,
			Validators:          []validator.Int64{int64validator.AtLeast(0)},
		},
		"seat_tiers": schema.SingleNestedAttribute{
			MarkdownDescription: "The seat pricing ladder for `seat_based` prices.",
			Optional:            true,
			Attributes: map[string]schema.Attribute{
				"seat_tier_type": schema.StringAttribute{
					MarkdownDescription: "How tiers apply: `volume` (default) prices every seat at the " +
						"matching tier's rate, `graduated` prices each tier's range independently.",
					Optional: true,
					Computed: true,
					Default:  stringdefault.StaticString("volume"),
					Validators: []validator.String{
						stringvalidator.OneOf("volume", "graduated"),
					},
				},
				"tiers": schema.ListNestedAttribute{
					MarkdownDescription: "The tiers, in ascending seat order. They must be contiguous " +
						"(each tier starts one seat after the previous one ends) and only the last one " +
						"may be unbounded. The API sorts them, so an out-of-order list is rejected at plan time.",
					Required:   true,
					Validators: []validator.List{listvalidator.SizeAtLeast(1)},
					NestedObject: schema.NestedAttributeObject{
						Attributes: map[string]schema.Attribute{
							"min_seats": schema.Int64Attribute{
								MarkdownDescription: "First seat covered by the tier, inclusive.",
								Required:            true,
								Validators:          []validator.Int64{int64validator.AtLeast(1)},
							},
							"max_seats": schema.Int64Attribute{
								MarkdownDescription: "Last seat covered by the tier, inclusive. " +
									"Omit on the last tier to leave it unbounded.",
								Optional:   true,
								Validators: []validator.Int64{int64validator.AtLeast(1)},
							},
							"price_per_seat": schema.Int64Attribute{
								MarkdownDescription: "Price per seat in cents. `0` makes the tier free.",
								Required:            true,
								Validators:          []validator.Int64{int64validator.AtLeast(0)},
							},
						},
					},
				},
			},
		},
		"meter_id": schema.StringAttribute{
			MarkdownDescription: "The meter billed by a `metered_unit` price. A meter may only back one " +
				"price per currency.",
			Optional: true,
		},
		"unit_amount": schema.StringAttribute{
			MarkdownDescription: "The price per metered unit, in cents, as a decimal string (e.g. `\"0.015\"`). " +
				"A string keeps the exact scale you wrote; up to 12 decimal places and 17 digits are stored.",
			Optional:   true,
			Validators: []validator.String{unitAmount()},
		},
		"cap_amount": schema.Int64Attribute{
			MarkdownDescription: "Cap in cents on what a `metered_unit` price can charge in a period, " +
				"however many units are consumed.",
			Optional:   true,
			Validators: []validator.Int64{int64validator.Between(0, 2147483647)},
		},
	}
}

func (r *productResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_product"
}

func (r *productResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "A product customers can buy, with its prices, benefits and checkout fields. " +
			"Polar has no product deletion: destroying this resource archives the product, which stops new " +
			"purchases while existing subscriptions and benefit grants continue. " +
			"Prices are immutable server-side — editing one archives it and creates a replacement with a new ID — " +
			"and the billing interval is fixed for the product's lifetime.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the product.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				MarkdownDescription: "The name of the product, shown at checkout and on invoices. 3 to 64 characters.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.LengthBetween(3, 64),
					strippedString(),
				},
			},
			"description": schema.StringAttribute{
				MarkdownDescription: "The description of the product, shown at checkout.",
				Optional:            true,
				Validators: []validator.String{
					stringvalidator.LengthAtLeast(1),
					strippedString(),
				},
			},
			"visibility": schema.StringAttribute{
				MarkdownDescription: "Where the product shows up: `public` (default), `private` (reachable " +
					"by direct link only) or `draft`.",
				Optional: true,
				Computed: true,
				Default:  stringdefault.StaticString("public"),
				Validators: []validator.String{
					stringvalidator.OneOf("draft", "private", "public"),
				},
			},
			"recurring_interval": schema.StringAttribute{
				MarkdownDescription: "The billing interval — `day`, `week`, `month` or `year` — making the " +
					"product a subscription. Omit for a one-time purchase. " +
					"The API rejects changing it on an existing product, so a change forces replacement.",
				Optional: true,
				Validators: []validator.String{
					stringvalidator.OneOf(productIntervals...),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"recurring_interval_count": schema.Int64Attribute{
				MarkdownDescription: "How many billing intervals each period spans: `1` (default) bills every " +
					"interval, `2` every other one. Only for recurring products; forces replacement when changed.",
				Optional:   true,
				Computed:   true,
				Validators: []validator.Int64{int64validator.Between(1, 999)},
				PlanModifiers: []planmodifier.Int64{
					int64planmodifier.UseStateForUnknown(),
					int64planmodifier.RequiresReplace(),
				},
			},
			"meter_interval": schema.StringAttribute{
				MarkdownDescription: "An optional meter cycle independent of the billing interval, e.g. " +
					"monthly credits on yearly billing. It must evenly divide the billing interval. " +
					"The API has no way to change it after creation, so a change forces replacement.",
				Optional: true,
				Validators: []validator.String{
					stringvalidator.OneOf(productIntervals...),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"meter_interval_count": schema.Int64Attribute{
				MarkdownDescription: "How many meter intervals each meter cycle spans. Defaults to `1` when " +
					"`meter_interval` is set. Forces replacement when changed.",
				Optional:   true,
				Computed:   true,
				Validators: []validator.Int64{int64validator.Between(1, 999)},
				PlanModifiers: []planmodifier.Int64{
					int64planmodifier.UseStateForUnknown(),
					int64planmodifier.RequiresReplace(),
				},
			},
			"trial_interval": schema.StringAttribute{
				MarkdownDescription: "The unit of the free trial granted to new subscribers: `day`, `week`, " +
					"`month` or `year`. Set together with `trial_interval_count`; recurring products only.",
				Optional: true,
				Validators: []validator.String{
					stringvalidator.OneOf(productIntervals...),
				},
			},
			"trial_interval_count": schema.Int64Attribute{
				MarkdownDescription: "How many trial intervals the free trial lasts, e.g. `14` with " +
					"`trial_interval = \"day\"`.",
				Optional:   true,
				Validators: []validator.Int64{int64validator.Between(1, 1000)},
			},
			"prices": schema.ListNestedAttribute{
				MarkdownDescription: "The prices the product is sold at, at least one. Per currency you may " +
					"combine one `fixed` price with one `seat_based` price, or have a single `custom` price, " +
					"plus any number of `metered_unit` prices (recurring products only). " +
					"Every currency you price in must offer the same set of price kinds.",
				Required:   true,
				Validators: []validator.List{listvalidator.SizeAtLeast(1)},
				PlanModifiers: []planmodifier.List{
					keepMatchedPriceIDs(),
				},
				NestedObject: schema.NestedAttributeObject{
					Attributes: productPriceAttributeSchema(),
				},
			},
			"benefits": schema.ListAttribute{
				MarkdownDescription: "IDs of the benefits granted by the product, in display order. " +
					"Applied through a separate endpoint that re-runs grant processing, so it is only called " +
					"when the list changes. Omit the attribute instead of passing an empty list.",
				Optional:    true,
				ElementType: types.StringType,
				Validators: []validator.List{
					listvalidator.SizeAtLeast(1),
				},
			},
			"attached_custom_fields": schema.ListNestedAttribute{
				MarkdownDescription: "Custom fields collected at checkout, in display order. " +
					"Omit the attribute instead of passing an empty list.",
				Optional:   true,
				Validators: []validator.List{listvalidator.SizeAtLeast(1)},
				NestedObject: schema.NestedAttributeObject{
					Attributes: map[string]schema.Attribute{
						"custom_field_id": schema.StringAttribute{
							MarkdownDescription: "The ID of the custom field to collect.",
							Required:            true,
						},
						"required": schema.BoolAttribute{
							MarkdownDescription: "Whether the customer must fill the field in.",
							Required:            true,
						},
					},
				},
			},
			"medias": schema.ListAttribute{
				MarkdownDescription: "IDs of `product_media` files shown on the checkout page, in display " +
					"order. Files must be uploaded through the files API first. " +
					"Omit the attribute instead of passing an empty list.",
				Optional:    true,
				ElementType: types.StringType,
				Validators: []validator.List{
					listvalidator.SizeAtLeast(1),
				},
			},
			"metadata": schema.MapAttribute{
				MarkdownDescription: "Key-value metadata stored on the product. Values are stored as strings.",
				Optional:            true,
				ElementType:         types.StringType,
			},
			"organization_id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization owning the product. " +
					"Not needed when authenticating with an organization access token.",
				Optional: true,
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
					stringplanmodifier.RequiresReplace(),
				},
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the product.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

// unitAmount validates the decimal string backing a metered price.
type unitAmountValidator struct{}

func (v unitAmountValidator) Description(ctx context.Context) string {
	return "must be a positive decimal with at most 12 decimal places, e.g. 0.015"
}

func (v unitAmountValidator) MarkdownDescription(ctx context.Context) string {
	return v.Description(ctx)
}

func (v unitAmountValidator) ValidateString(ctx context.Context, req validator.StringRequest, resp *validator.StringResponse) {
	if req.ConfigValue.IsNull() || req.ConfigValue.IsUnknown() {
		return
	}
	value := req.ConfigValue.ValueString()
	invalid := func(detail string) {
		resp.Diagnostics.AddAttributeError(req.Path, "Invalid unit amount", detail)
	}
	if !unitAmountRegex.MatchString(value) {
		invalid(fmt.Sprintf("The unit amount must be a plain decimal number such as \"0.015\", got %q.", value))
		return
	}
	integer, fraction, _ := strings.Cut(value, ".")
	if len(fraction) > unitAmountDecimalPlaces {
		invalid(fmt.Sprintf("The API stores at most %d decimal places, got %d.", unitAmountDecimalPlaces, len(fraction)))
		return
	}
	if len(strings.TrimLeft(integer, "0"))+len(fraction) > unitAmountDigits {
		invalid(fmt.Sprintf("The API stores at most %d digits.", unitAmountDigits))
		return
	}
	if decimalsEqual(value, "0") {
		invalid("The unit amount must be greater than zero. Use a fixed price of 0 for free pricing.")
	}
}

func unitAmount() validator.String {
	return unitAmountValidator{}
}

// productConfigModel is the slice of a product's configuration ValidateConfig
// inspects. It is read attribute by attribute rather than with Config.Get so
// that collections the configuration cannot describe yet — `prices = var.prices`
// in a reusable module, `attached_custom_fields` built from a resource that
// does not exist yet — skip validation instead of failing it: reflecting an
// unknown list into a Go slice is an error the framework blames on the
// provider. attached_custom_fields is simply never read; there is nothing to
// check about it at plan time.
type productConfigModel struct {
	RecurringInterval      types.String
	RecurringIntervalCount types.Int64
	MeterInterval          types.String
	MeterIntervalCount     types.Int64
	TrialInterval          types.String
	TrialIntervalCount     types.Int64
	// Prices is only populated when every price is described well enough to
	// check, which PricesKnown reports.
	Prices      []productPriceModel
	PricesKnown bool
}

func productConfig(ctx context.Context, config tfsdk.Config, diags *diag.Diagnostics) productConfigModel {
	var model productConfigModel
	scalars := []struct {
		name   string
		target any
	}{
		{"recurring_interval", &model.RecurringInterval},
		{"recurring_interval_count", &model.RecurringIntervalCount},
		{"meter_interval", &model.MeterInterval},
		{"meter_interval_count", &model.MeterIntervalCount},
		{"trial_interval", &model.TrialInterval},
		{"trial_interval_count", &model.TrialIntervalCount},
	}
	for _, scalar := range scalars {
		diags.Append(config.GetAttribute(ctx, path.Root(scalar.name), scalar.target)...)
	}

	var prices types.List
	diags.Append(config.GetAttribute(ctx, path.Root("prices"), &prices)...)
	if diags.HasError() || prices.IsNull() || !collectionsKnown(prices) {
		return model
	}
	elementDiags := prices.ElementsAs(ctx, &model.Prices, false)
	diags.Append(elementDiags...)
	model.PricesKnown = !elementDiags.HasError()
	return model
}

func (r *productResource) ValidateConfig(ctx context.Context, req resource.ValidateConfigRequest, resp *resource.ValidateConfigResponse) {
	config := productConfig(ctx, req.Config, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	oneTime := config.RecurringInterval.IsNull()
	if oneTime {
		notRecurring := func(attribute string) {
			resp.Diagnostics.AddAttributeError(
				path.Root(attribute),
				"Attribute not allowed",
				fmt.Sprintf("%s is only allowed on recurring products; set recurring_interval to sell a subscription.", attribute),
			)
		}
		if !config.RecurringIntervalCount.IsNull() {
			notRecurring("recurring_interval_count")
		}
		if !config.MeterInterval.IsNull() {
			notRecurring("meter_interval")
		}
		if !config.MeterIntervalCount.IsNull() {
			notRecurring("meter_interval_count")
		}
		if !config.TrialInterval.IsNull() {
			notRecurring("trial_interval")
		}
		if !config.TrialIntervalCount.IsNull() {
			notRecurring("trial_interval_count")
		}
	}

	if config.TrialInterval.IsNull() != config.TrialIntervalCount.IsNull() {
		resp.Diagnostics.AddAttributeError(
			path.Root("trial_interval_count"),
			"Incomplete trial configuration",
			"trial_interval and trial_interval_count must be set together.",
		)
	}

	if config.MeterInterval.IsNull() && !config.MeterIntervalCount.IsNull() {
		resp.Diagnostics.AddAttributeError(
			path.Root("meter_interval_count"),
			"Attribute not allowed",
			"meter_interval_count is only allowed together with meter_interval.",
		)
	}
	validateMeterCycle(config, resp)

	if !config.PricesKnown {
		return
	}
	metered := false
	for index, price := range config.Prices {
		validatePriceAttributes(price, path.Root("prices").AtListIndex(index), resp)
		if price.AmountType.ValueString() == "metered_unit" {
			metered = true
		}
	}
	if metered && oneTime {
		resp.Diagnostics.AddAttributeError(
			path.Root("prices"),
			"Metered pricing not allowed",
			"Metered prices are only supported on recurring products; set recurring_interval.",
		)
	}
	validatePriceCombination(config.Prices, resp)
}

// validateMeterCycle mirrors the server's rule that the meter cycle must
// re-align with the billing cycle at every renewal.
func validateMeterCycle(config productConfigModel, resp *resource.ValidateConfigResponse) {
	if config.MeterInterval.IsNull() || config.MeterInterval.IsUnknown() ||
		config.RecurringInterval.IsNull() || config.RecurringInterval.IsUnknown() ||
		config.MeterIntervalCount.IsUnknown() || config.RecurringIntervalCount.IsUnknown() {
		return
	}
	meterCount, billingCount := int64(1), int64(1)
	if !config.MeterIntervalCount.IsNull() {
		meterCount = config.MeterIntervalCount.ValueInt64()
	}
	if !config.RecurringIntervalCount.IsNull() {
		billingCount = config.RecurringIntervalCount.ValueInt64()
	}
	if meterIntervalDividesBillingInterval(
		config.MeterInterval.ValueString(), meterCount,
		config.RecurringInterval.ValueString(), billingCount,
	) {
		return
	}
	resp.Diagnostics.AddAttributeError(
		path.Root("meter_interval"),
		"Meter cycle does not divide the billing cycle",
		"The meter interval must evenly divide the billing interval so the meter cycle re-aligns with "+
			"the billing cycle at every renewal.",
	)
}

// meterIntervalDividesBillingInterval mirrors
// server/polar/product/meter_interval.py: day/week intervals are commensurable
// with each other and month/year intervals with each other, but the two
// families only convert cleanly for a daily meter cycle.
func meterIntervalDividesBillingInterval(meterInterval string, meterCount int64, billingInterval string, billingCount int64) bool {
	switch {
	case meterInterval == billingInterval:
		return billingCount%meterCount == 0
	case meterInterval == "day" && billingInterval == "week":
		return (billingCount*7)%meterCount == 0
	case meterInterval == "day" && (billingInterval == "month" || billingInterval == "year"):
		return meterCount == 1
	case meterInterval == "month" && billingInterval == "year":
		return (billingCount*12)%meterCount == 0
	default:
		return false
	}
}

func validatePriceAttributes(price productPriceModel, pricePath path.Path, resp *resource.ValidateConfigResponse) {
	if price.AmountType.IsNull() || price.AmountType.IsUnknown() {
		return
	}
	amountType := price.AmountType.ValueString()
	allowed, known := productPriceAllowedAttributes[amountType]
	if !known {
		return
	}

	set := map[string]bool{
		"price_amount":   !price.PriceAmount.IsNull(),
		"minimum_amount": !price.MinimumAmount.IsNull(),
		"maximum_amount": !price.MaximumAmount.IsNull(),
		"preset_amount":  !price.PresetAmount.IsNull(),
		"seat_tiers":     price.SeatTiers != nil,
		"meter_id":       !price.MeterID.IsNull(),
		"unit_amount":    !price.UnitAmount.IsNull(),
		"cap_amount":     !price.CapAmount.IsNull(),
	}
	for _, attribute := range productPriceAmountAttributes {
		if set[attribute] && !slices.Contains(allowed, attribute) {
			resp.Diagnostics.AddAttributeError(
				pricePath.AtName(attribute),
				"Attribute not allowed",
				fmt.Sprintf("%s is not allowed on a %q price; it belongs to %s.",
					attribute, amountType, priceAmountTypesAllowing(attribute)),
			)
		}
	}
	for _, attribute := range productPriceRequiredAttributes[amountType] {
		if !set[attribute] {
			resp.Diagnostics.AddAttributeError(
				pricePath.AtName(attribute),
				"Missing price attribute",
				fmt.Sprintf("%s is required on a %q price.", attribute, amountType),
			)
		}
	}

	if price.SeatTiers != nil {
		validateSeatTiers(price.SeatTiers.Tiers, pricePath.AtName("seat_tiers").AtName("tiers"), resp)
	}
}

func priceAmountTypesAllowing(attribute string) string {
	owners := make([]string, 0, len(productPriceAmountTypes))
	for _, amountType := range productPriceAmountTypes {
		if slices.Contains(productPriceAllowedAttributes[amountType], attribute) {
			owners = append(owners, fmt.Sprintf("%q", amountType))
		}
	}
	return strings.Join(owners, " and ")
}

// validateSeatTiers mirrors the server's contiguity check. The server also
// sorts the tiers before storing them, so an out-of-order list is rejected
// here rather than left as a permanent diff.
func validateSeatTiers(tiers []productSeatTierModel, tiersPath path.Path, resp *resource.ValidateConfigResponse) {
	for index, tier := range tiers {
		if tier.MinSeats.IsUnknown() || tier.MaxSeats.IsUnknown() {
			return
		}
		if index == len(tiers)-1 {
			break
		}
		next := tiers[index+1]
		if next.MinSeats.IsUnknown() {
			return
		}
		if tier.MaxSeats.IsNull() {
			resp.Diagnostics.AddAttributeError(
				tiersPath.AtListIndex(index).AtName("max_seats"),
				"Unbounded tier is not last",
				"Only the last tier may omit max_seats.",
			)
			return
		}
		if next.MinSeats.ValueInt64() != tier.MaxSeats.ValueInt64()+1 {
			resp.Diagnostics.AddAttributeError(
				tiersPath.AtListIndex(index+1).AtName("min_seats"),
				"Seat tiers are not contiguous",
				fmt.Sprintf(
					"Tiers must be listed in ascending seat order without gaps or overlaps: the previous tier "+
						"ends at %d seats, so this one must start at %d, got %d.",
					tier.MaxSeats.ValueInt64(), tier.MaxSeats.ValueInt64()+1, next.MinSeats.ValueInt64(),
				),
			)
			return
		}
	}
}

// priceStructure records which price kinds a currency offers; the server
// requires every currency to offer the same set.
type priceStructure struct {
	fixed     int
	custom    int
	seatBased int
	meters    []string
}

func validatePriceCombination(prices []productPriceModel, resp *resource.ValidateConfigResponse) {
	structures := map[string]*priceStructure{}
	currencies := []string{}
	taxBehaviors := map[string]map[string]bool{}

	for index, price := range prices {
		if price.AmountType.IsNull() || price.AmountType.IsUnknown() ||
			price.PriceCurrency.IsUnknown() || price.TaxBehavior.IsUnknown() {
			return
		}
		currency := "usd"
		if !price.PriceCurrency.IsNull() {
			currency = price.PriceCurrency.ValueString()
		}
		structure, seen := structures[currency]
		if !seen {
			structure = &priceStructure{}
			structures[currency] = structure
			taxBehaviors[currency] = map[string]bool{}
			currencies = append(currencies, currency)
		}
		taxBehaviors[currency][price.TaxBehavior.ValueString()] = true

		switch price.AmountType.ValueString() {
		case "fixed":
			structure.fixed++
		case "custom":
			structure.custom++
		case "seat_based":
			structure.seatBased++
		case "metered_unit":
			if price.MeterID.IsUnknown() || price.MeterID.IsNull() {
				continue
			}
			meter := price.MeterID.ValueString()
			if slices.Contains(structure.meters, meter) {
				resp.Diagnostics.AddAttributeError(
					path.Root("prices").AtListIndex(index).AtName("meter_id"),
					"Meter already priced",
					fmt.Sprintf("A meter may only back one price per currency, and this one already backs a %s price.", currency),
				)
				continue
			}
			structure.meters = append(structure.meters, meter)
		}
	}

	if len(currencies) == 0 {
		return
	}
	slices.Sort(currencies)
	for _, currency := range currencies {
		structure := structures[currency]
		tooMany := func(kind string) {
			resp.Diagnostics.AddAttributeError(
				path.Root("prices"),
				"Too many prices of the same kind",
				fmt.Sprintf("Only one %s price is allowed per currency, and %s has more than one.", kind, currency),
			)
		}
		if structure.fixed > 1 {
			tooMany("fixed")
		}
		if structure.seatBased > 1 {
			tooMany("seat_based")
		}
		if structure.custom > 1 {
			tooMany("custom")
		}
		if structure.custom > 0 && (structure.fixed > 0 || structure.seatBased > 0) {
			resp.Diagnostics.AddAttributeError(
				path.Root("prices"),
				"Incompatible prices",
				fmt.Sprintf("A custom price cannot be combined with a fixed or seat-based price, and %s combines them.", currency),
			)
		}
		if len(taxBehaviors[currency]) > 1 {
			resp.Diagnostics.AddAttributeError(
				path.Root("prices"),
				"Conflicting tax behavior",
				fmt.Sprintf("All prices sharing a currency must have the same tax_behavior, and %s mixes several.", currency),
			)
		}
	}

	for _, currency := range currencies[1:] {
		if samePriceStructure(structures[currencies[0]], structures[currency]) {
			continue
		}
		resp.Diagnostics.AddAttributeError(
			path.Root("prices"),
			"Currencies price differently",
			fmt.Sprintf("Every currency must offer the same set of price kinds, and %s differs from %s.",
				currency, currencies[0]),
		)
		return
	}
}

func samePriceStructure(a, b *priceStructure) bool {
	return (a.fixed > 0) == (b.fixed > 0) &&
		(a.custom > 0) == (b.custom > 0) &&
		(a.seatBased > 0) == (b.seatBased > 0) &&
		len(a.meters) == len(b.meters)
}

// keepMatchedPriceIDs re-assigns the server-generated price IDs the framework
// blanks out whenever anything on the product changes. A planned price that
// still matches a price in state keeps that price's ID (so the update asks the
// API to keep it); anything else stays unknown and is created fresh.
type keepMatchedPriceIDsModifier struct{}

func keepMatchedPriceIDs() planmodifier.List {
	return keepMatchedPriceIDsModifier{}
}

func (m keepMatchedPriceIDsModifier) Description(ctx context.Context) string {
	return "Keeps the ID of prices that are unchanged, and leaves it unknown for prices the API will recreate."
}

func (m keepMatchedPriceIDsModifier) MarkdownDescription(ctx context.Context) string {
	return m.Description(ctx)
}

func (m keepMatchedPriceIDsModifier) PlanModifyList(ctx context.Context, req planmodifier.ListRequest, resp *planmodifier.ListResponse) {
	// Nothing to carry over when creating or destroying the product.
	if req.State.Raw.IsNull() || req.Plan.Raw.IsNull() {
		return
	}
	if req.PlanValue.IsNull() || req.PlanValue.IsUnknown() {
		return
	}

	// Every price the plan cannot describe yet — one built from a resource
	// that does not exist — makes matching impossible. Blanking every ID is
	// then the only safe answer: Terraform fills a list of nested attributes
	// by index, so the prior state's IDs would otherwise pin each price to
	// whatever happened to sit at its position, and the update, which matches
	// by value, would disagree with the plan it is applying.
	ids := unknownPriceIDs(len(req.PlanValue.Elements()))
	if collectionsKnown(req.PlanValue) && !req.StateValue.IsNull() && collectionsKnown(req.StateValue) {
		var planned, state []productPriceModel
		resp.Diagnostics.Append(req.PlanValue.ElementsAs(ctx, &planned, false)...)
		resp.Diagnostics.Append(req.StateValue.ElementsAs(ctx, &state, false)...)
		if resp.Diagnostics.HasError() {
			return
		}
		ids = plannedPriceIDs(planned, state)
	}

	elements := make([]attr.Value, 0, len(ids))
	for index, element := range req.PlanValue.Elements() {
		object, ok := element.(types.Object)
		if !ok || object.IsNull() || object.IsUnknown() {
			// A price that is wholly unknown already implies an unknown ID.
			elements = append(elements, element)
			continue
		}
		attributes := make(map[string]attr.Value, len(object.Attributes()))
		for name, value := range object.Attributes() {
			attributes[name] = value
		}
		attributes["id"] = ids[index]
		value, diags := types.ObjectValue(object.AttributeTypes(ctx), attributes)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
		elements = append(elements, value)
	}

	list, diags := types.ListValue(req.PlanValue.ElementType(ctx), elements)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.PlanValue = list
}

func unknownPriceIDs(count int) []types.String {
	ids := make([]types.String, count)
	for index := range ids {
		ids[index] = types.StringUnknown()
	}
	return ids
}

func (r *productResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

func (r *productResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan productModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	medias, diags := stringListToAPI(ctx, plan.Medias)
	resp.Diagnostics.Append(diags...)
	benefits, diags := stringListToAPI(ctx, plan.Benefits)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	create := polarapi.ProductCreate{
		Name:                   plan.Name.ValueString(),
		Description:            stringPointer(plan.Description),
		Visibility:             plan.Visibility.ValueString(),
		RecurringInterval:      stringPointer(plan.RecurringInterval),
		RecurringIntervalCount: int64Pointer(plan.RecurringIntervalCount),
		MeterInterval:          stringPointer(plan.MeterInterval),
		MeterIntervalCount:     int64Pointer(plan.MeterIntervalCount),
		TrialInterval:          stringPointer(plan.TrialInterval),
		TrialIntervalCount:     int64Pointer(plan.TrialIntervalCount),
		Prices:                 pricesToAPI(plan.Prices),
		Medias:                 medias,
		AttachedCustomFields:   customFieldsToAPI(plan.AttachedCustomFields),
		OrganizationID:         stringPointer(plan.OrganizationID),
		Metadata:               metadata,
	}

	product, err := r.client.CreateProduct(ctx, create)
	if err != nil {
		resp.Diagnostics.AddError("Failed to create product", productErrorMessage(err))
		return
	}

	if len(benefits) > 0 {
		// The product exists whatever happens next: persist it before the
		// benefits call so a failure there doesn't orphan it.
		model, diags := productToModel(ctx, product, &plan)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
		resp.Diagnostics.Append(resp.State.Set(ctx, model)...)

		product, err = r.client.UpdateProductBenefits(ctx, product.ID, benefits)
		if err != nil {
			resp.Diagnostics.AddError("Failed to attach the product's benefits", err.Error())
			return
		}
	}

	model, diags := productToModel(ctx, product, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *productResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state productModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	product, err := r.client.GetProduct(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read product", err.Error())
		return
	}

	// An archived product can no longer be bought: treat it as destroyed,
	// mirroring the archive-on-destroy semantics below.
	if product.IsArchived {
		resp.State.RemoveResource(ctx)
		return
	}

	model, diags := productToModel(ctx, product, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *productResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan, state productModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	medias, diags := stringListToAPI(ctx, plan.Medias)
	resp.Diagnostics.Append(diags...)
	benefits, diags := stringListToAPI(ctx, plan.Benefits)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	if medias == nil {
		// The server keeps medias on null and replaces them with the list given.
		medias = []string{}
	}

	customFields := customFieldsToAPI(plan.AttachedCustomFields)
	if customFields == nil {
		customFields = []polarapi.ProductAttachedCustomField{}
	}

	update := polarapi.ProductUpdate{
		Name:                 stringPointer(plan.Name),
		Description:          stringPointer(plan.Description),
		Visibility:           stringPointer(plan.Visibility),
		TrialInterval:        stringPointer(plan.TrialInterval),
		TrialIntervalCount:   int64Pointer(plan.TrialIntervalCount),
		Prices:               pricesToAPIUpdate(plan.Prices, state.Prices),
		Medias:               medias,
		AttachedCustomFields: customFields,
		Metadata:             &metadata,
	}

	product, err := r.client.UpdateProduct(ctx, plan.ID.ValueString(), update)
	if err != nil {
		resp.Diagnostics.AddError("Failed to update product", productErrorMessage(err))
		return
	}

	// The benefits endpoint re-runs grant processing for every customer, so
	// only call it when the attachment list actually changed.
	if !plan.Benefits.Equal(state.Benefits) {
		model, diags := productToModel(ctx, product, &plan)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
		resp.Diagnostics.Append(resp.State.Set(ctx, model)...)

		product, err = r.client.UpdateProductBenefits(ctx, plan.ID.ValueString(), benefits)
		if err != nil {
			resp.Diagnostics.AddError("Failed to update the product's benefits", err.Error())
			return
		}
	}

	model, diags := productToModel(ctx, product, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *productResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state productModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Polar has no product deletion; archiving is the terminal state.
	if _, err := r.client.ArchiveProduct(ctx, state.ID.ValueString()); err != nil && !polarapi.IsNotFound(err) {
		resp.Diagnostics.AddError("Failed to archive product", err.Error())
	}
}

func (r *productResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// productErrorMessage adds the context the API's validation errors leave
// implicit around the two rules Terraform users hit most.
func productErrorMessage(err error) string {
	message := err.Error()
	apiErr, ok := err.(*polarapi.APIError)
	if !ok || apiErr.StatusCode != http.StatusUnprocessableEntity {
		return message
	}
	switch {
	case strings.Contains(apiErr.Detail, "Seat-based pricing is not enabled"):
		message += "\n\nSeat-based pricing is a per-organization feature; ask Polar to enable it before " +
			"declaring a seat_based price."
	case strings.Contains(apiErr.Detail, "default presentment currency"):
		message += "\n\nAt least one price must be in the organization's default presentment currency."
	}
	return message
}

func pricesToAPI(prices []productPriceModel) []polarapi.ProductPriceCreate {
	payload := make([]polarapi.ProductPriceCreate, 0, len(prices))
	for _, price := range prices {
		payload = append(payload, priceToAPI(price))
	}
	return payload
}

func priceToAPI(price productPriceModel) polarapi.ProductPriceCreate {
	create := polarapi.ProductPriceCreate{
		AmountType:    price.AmountType.ValueString(),
		PriceCurrency: price.PriceCurrency.ValueString(),
		TaxBehavior:   stringPointer(price.TaxBehavior),
	}
	switch create.AmountType {
	case "fixed":
		create.PriceAmount = int64Pointer(price.PriceAmount)
	case "custom":
		create.MinimumAmount = int64Pointer(price.MinimumAmount)
		create.MaximumAmount = int64Pointer(price.MaximumAmount)
		create.PresetAmount = int64Pointer(price.PresetAmount)
	case "seat_based":
		if price.SeatTiers != nil {
			tiers := make([]polarapi.ProductPriceSeatTier, 0, len(price.SeatTiers.Tiers))
			for _, tier := range price.SeatTiers.Tiers {
				tiers = append(tiers, polarapi.ProductPriceSeatTier{
					MinSeats:     tier.MinSeats.ValueInt64(),
					MaxSeats:     int64Pointer(tier.MaxSeats),
					PricePerSeat: tier.PricePerSeat.ValueInt64(),
				})
			}
			create.SeatTiers = &polarapi.ProductPriceSeatTiers{
				SeatTierType: price.SeatTiers.SeatTierType.ValueString(),
				Tiers:        tiers,
			}
		}
	case "metered_unit":
		create.MeterID = stringPointer(price.MeterID)
		create.UnitAmount = stringPointer(price.UnitAmount)
		create.CapAmount = int64Pointer(price.CapAmount)
	}
	return create
}

// pricesToAPIUpdate turns the planned prices into the API's keep-or-create
// union. A planned price that still matches a price in state is referenced by
// ID so the API keeps it; everything else is sent as a create payload. Prices
// the API is not told to keep are archived, which is how a price "changes".
func pricesToAPIUpdate(planned, state []productPriceModel) []polarapi.ProductPriceUpdate {
	ids := plannedPriceIDs(planned, state)
	payload := make([]polarapi.ProductPriceUpdate, 0, len(planned))
	for index, price := range planned {
		if id := ids[index]; !id.IsUnknown() {
			existing := id.ValueString()
			payload = append(payload, polarapi.ProductPriceUpdate{ExistingID: &existing})
			continue
		}
		create := priceToAPI(price)
		payload = append(payload, polarapi.ProductPriceUpdate{Create: &create})
	}
	return payload
}

// plannedPriceIDs resolves the ID each planned price should carry: the ID of
// the price in state it still matches, or unknown for a price the API is going
// to create. The plan modifier and the update payload share it so the ID shown
// in the plan is exactly the one the update asks the API to keep.
func plannedPriceIDs(planned, state []productPriceModel) []types.String {
	matches := matchPricesToState(planned, state)
	ids := make([]types.String, len(planned))
	for index := range planned {
		ids[index] = types.StringUnknown()
		if match := matches[index]; match >= 0 && !state[match].ID.IsNull() && !state[match].ID.IsUnknown() {
			ids[index] = state[match].ID
		}
	}
	return ids
}

// matchPricesToState pairs each planned price with the price in state that has
// the same value, ignoring the server-assigned ID. A state price can only back
// one planned price, and a planned price carrying unknown values never matches:
// the provider cannot prove it describes the same price, so it is recreated.
func matchPricesToState(planned, state []productPriceModel) []int {
	matches := make([]int, len(planned))
	consumed := make([]bool, len(state))
	for index := range matches {
		matches[index] = -1
	}
	for index, price := range planned {
		for candidate := range state {
			if consumed[candidate] || !pricesMatch(price, state[candidate], exactPriceMatch) {
				continue
			}
			matches[index] = candidate
			consumed[candidate] = true
			break
		}
	}
	return matches
}

// priceMatchMode decides how unknown values on the planned side are treated.
type priceMatchMode int

const (
	// exactPriceMatch never matches an unknown value: it is used to decide
	// whether an existing price can be kept, where guessing wrong would keep
	// the wrong price.
	exactPriceMatch priceMatchMode = iota
	// responsePriceMatch treats unknown planned values as satisfied by the
	// API's value: it is used to line the API's prices up with the plan, where
	// unknowns are exactly the values the API just filled in.
	responsePriceMatch
)

func pricesMatch(planned, other productPriceModel, mode priceMatchMode) bool {
	if !stringsMatch(planned.AmountType, other.AmountType, mode) ||
		!stringsMatch(planned.PriceCurrency, other.PriceCurrency, mode) ||
		!stringsMatch(planned.TaxBehavior, other.TaxBehavior, mode) {
		return false
	}
	switch planned.AmountType.ValueString() {
	case "fixed":
		return int64sMatch(planned.PriceAmount, other.PriceAmount, mode)
	case "custom":
		return int64sMatch(planned.MinimumAmount, other.MinimumAmount, mode) &&
			int64sMatch(planned.MaximumAmount, other.MaximumAmount, mode) &&
			int64sMatch(planned.PresetAmount, other.PresetAmount, mode)
	case "seat_based":
		return seatTiersMatch(planned.SeatTiers, other.SeatTiers, mode)
	case "metered_unit":
		return stringsMatch(planned.MeterID, other.MeterID, mode) &&
			int64sMatch(planned.CapAmount, other.CapAmount, mode) &&
			unitAmountsMatch(planned.UnitAmount, other.UnitAmount, mode)
	}
	return false
}

func seatTiersMatch(planned, other *productSeatTiersModel, mode priceMatchMode) bool {
	if planned == nil || other == nil {
		return planned == other
	}
	if !stringsMatch(planned.SeatTierType, other.SeatTierType, mode) || len(planned.Tiers) != len(other.Tiers) {
		return false
	}
	for index, tier := range planned.Tiers {
		if !int64sMatch(tier.MinSeats, other.Tiers[index].MinSeats, mode) ||
			!int64sMatch(tier.MaxSeats, other.Tiers[index].MaxSeats, mode) ||
			!int64sMatch(tier.PricePerSeat, other.Tiers[index].PricePerSeat, mode) {
			return false
		}
	}
	return true
}

func stringsMatch(planned, other types.String, mode priceMatchMode) bool {
	if planned.IsUnknown() {
		return mode == responsePriceMatch
	}
	return !other.IsUnknown() && planned.Equal(other)
}

func int64sMatch(planned, other types.Int64, mode priceMatchMode) bool {
	if planned.IsUnknown() {
		return mode == responsePriceMatch
	}
	return !other.IsUnknown() && planned.Equal(other)
}

// unitAmountsMatch compares metered unit amounts numerically: "0.015" and
// "0.0150" are the same price written two ways.
func unitAmountsMatch(planned, other types.String, mode priceMatchMode) bool {
	if planned.IsUnknown() {
		return mode == responsePriceMatch
	}
	if other.IsUnknown() {
		return false
	}
	if planned.IsNull() || other.IsNull() {
		return planned.Equal(other)
	}
	return decimalsEqual(planned.ValueString(), other.ValueString())
}

func customFieldsToAPI(customFields []productCustomFieldModel) []polarapi.ProductAttachedCustomField {
	if customFields == nil {
		return nil
	}
	payload := make([]polarapi.ProductAttachedCustomField, 0, len(customFields))
	for _, customField := range customFields {
		payload = append(payload, polarapi.ProductAttachedCustomField{
			CustomFieldID: customField.CustomFieldID.ValueString(),
			Required:      customField.Required.ValueBool(),
		})
	}
	return payload
}

// pricesFromAPI maps the API's prices back onto the plan's ordering. The API
// returns catalog prices in its own order (static first, then metered), and
// ad-hoc prices created by Checkout sessions are dropped so they never enter
// state. Prices the plan doesn't account for are appended: that is genuine
// drift and should show up as one.
func pricesFromAPI(prices []polarapi.ProductPrice, prior []productPriceModel) ([]productPriceModel, error) {
	models := make([]productPriceModel, 0, len(prices))
	for _, price := range prices {
		if price.IsArchived || (price.Source != "" && price.Source != polarapi.ProductPriceSourceCatalog) {
			continue
		}
		model, err := priceFromAPI(price)
		if err != nil {
			return nil, err
		}
		models = append(models, model)
	}
	return orderPricesLikePrior(models, prior), nil
}

func orderPricesLikePrior(models, prior []productPriceModel) []productPriceModel {
	assigned := make([]int, len(prior))
	consumed := make([]bool, len(models))
	for index := range assigned {
		assigned[index] = -1
	}
	// Kept prices carry their ID through the plan, which is the strongest
	// signal available; the rest are lined up by value.
	for index, price := range prior {
		if price.ID.IsNull() || price.ID.IsUnknown() {
			continue
		}
		for candidate := range models {
			if consumed[candidate] || !models[candidate].ID.Equal(price.ID) {
				continue
			}
			assigned[index], consumed[candidate] = candidate, true
			break
		}
	}
	for index, price := range prior {
		if assigned[index] >= 0 {
			continue
		}
		for candidate := range models {
			if consumed[candidate] || !pricesMatch(price, models[candidate], responsePriceMatch) {
				continue
			}
			assigned[index], consumed[candidate] = candidate, true
			break
		}
	}

	ordered := make([]productPriceModel, 0, len(models))
	for index, candidate := range assigned {
		if candidate < 0 {
			continue
		}
		ordered = append(ordered, keepPriorUnitAmount(models[candidate], prior[index]))
	}
	for candidate, model := range models {
		if consumed[candidate] {
			continue
		}
		ordered = append(ordered, model)
	}
	return ordered
}

// keepPriorUnitAmount keeps the configured spelling of a metered unit amount
// when the API's value is the same number at a different scale.
func keepPriorUnitAmount(price, prior productPriceModel) productPriceModel {
	if price.UnitAmount.IsNull() {
		return price
	}
	apiValue := price.UnitAmount.ValueString()
	price.UnitAmount = keepEquivalentDecimal(prior.UnitAmount, &apiValue)
	return price
}

func priceFromAPI(price polarapi.ProductPrice) (productPriceModel, error) {
	if price.Legacy {
		return productPriceModel{}, fmt.Errorf(
			"price %s is a legacy recurring price, which carries its own billing interval and cannot be "+
				"represented by this provider; manage this product outside Terraform or migrate it to a "+
				"product-level recurring interval in the dashboard", price.ID,
		)
	}
	model := productPriceModel{
		ID:            types.StringValue(price.ID),
		AmountType:    types.StringValue(price.AmountType),
		PriceCurrency: types.StringValue(price.PriceCurrency),
		TaxBehavior:   stringFromPointer(price.TaxBehavior),
	}
	switch price.AmountType {
	case "fixed":
		model.PriceAmount = int64FromPointer(price.PriceAmount)
	case "custom":
		model.MinimumAmount = int64FromPointer(price.MinimumAmount)
		model.MaximumAmount = int64FromPointer(price.MaximumAmount)
		model.PresetAmount = int64FromPointer(price.PresetAmount)
	case "seat_based":
		if price.SeatTiers == nil {
			return productPriceModel{}, fmt.Errorf("seat-based price %s has no seat tiers", price.ID)
		}
		tiers := make([]productSeatTierModel, 0, len(price.SeatTiers.Tiers))
		for _, tier := range price.SeatTiers.Tiers {
			tiers = append(tiers, productSeatTierModel{
				MinSeats:     types.Int64Value(tier.MinSeats),
				MaxSeats:     int64FromPointer(tier.MaxSeats),
				PricePerSeat: types.Int64Value(tier.PricePerSeat),
			})
		}
		model.SeatTiers = &productSeatTiersModel{
			SeatTierType: types.StringValue(price.SeatTiers.SeatTierType),
			Tiers:        tiers,
		}
	case "metered_unit":
		model.MeterID = stringFromPointer(price.MeterID)
		model.CapAmount = int64FromPointer(price.CapAmount)
		if price.UnitAmount != nil {
			model.UnitAmount = types.StringValue(price.UnitAmount.String())
		}
	default:
		return productPriceModel{}, fmt.Errorf(
			"price %s has amount type %q, which is not supported by this provider yet; manage this product "+
				"outside Terraform", price.ID, price.AmountType,
		)
	}
	return model, nil
}

func customFieldsFromAPI(customFields []polarapi.ProductAttachedCustomField, prior []productCustomFieldModel) []productCustomFieldModel {
	if len(customFields) == 0 {
		if prior != nil && len(prior) == 0 {
			return prior
		}
		return nil
	}
	models := make([]productCustomFieldModel, 0, len(customFields))
	for _, customField := range customFields {
		models = append(models, productCustomFieldModel{
			CustomFieldID: types.StringValue(customField.CustomFieldID),
			Required:      types.BoolValue(customField.Required),
		})
	}
	return models
}

func productToModel(ctx context.Context, product *polarapi.Product, prior *productModel) (productModel, diag.Diagnostics) {
	var diags diag.Diagnostics

	var priorPrices []productPriceModel
	priorBenefits, priorMedias := types.ListNull(types.StringType), types.ListNull(types.StringType)
	var priorCustomFields []productCustomFieldModel
	if prior != nil {
		priorPrices = prior.Prices
		priorBenefits, priorMedias = prior.Benefits, prior.Medias
		priorCustomFields = prior.AttachedCustomFields
	}

	prices, err := pricesFromAPI(product.Prices, priorPrices)
	if err != nil {
		diags.AddError("Unsupported product price", err.Error())
		return productModel{}, diags
	}

	benefitIDs := make([]string, 0, len(product.Benefits))
	for _, benefit := range product.Benefits {
		benefitIDs = append(benefitIDs, benefit.ID)
	}
	mediaIDs := make([]string, 0, len(product.Medias))
	for _, media := range product.Medias {
		mediaIDs = append(mediaIDs, media.ID)
	}

	metadata := metadataFromAPI(ctx, product.Metadata)
	if metadata.IsNull() && prior != nil && priorMetadataIsEmptyMap(prior.Metadata) {
		metadata = prior.Metadata
	}

	return productModel{
		ID:                     types.StringValue(product.ID),
		Name:                   types.StringValue(product.Name),
		Description:            stringFromPointer(product.Description),
		Visibility:             types.StringValue(product.Visibility),
		RecurringInterval:      stringFromPointer(product.RecurringInterval),
		RecurringIntervalCount: int64FromPointer(product.RecurringIntervalCount),
		MeterInterval:          stringFromPointer(product.MeterInterval),
		MeterIntervalCount:     int64FromPointer(product.MeterIntervalCount),
		TrialInterval:          stringFromPointer(product.TrialInterval),
		TrialIntervalCount:     int64FromPointer(product.TrialIntervalCount),
		Prices:                 prices,
		Benefits:               stringListFromAPI(ctx, benefitIDs, priorBenefits),
		AttachedCustomFields:   customFieldsFromAPI(product.AttachedCustomFields, priorCustomFields),
		Medias:                 stringListFromAPI(ctx, mediaIDs, priorMedias),
		Metadata:               metadata,
		OrganizationID:         types.StringValue(product.OrganizationID),
		CreatedAt:              types.StringValue(product.CreatedAt),
	}, diags
}
