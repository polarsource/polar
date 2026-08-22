package provider

import (
	"context"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/listvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/mapvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	_ resource.Resource                   = (*discountResource)(nil)
	_ resource.ResourceWithConfigure      = (*discountResource)(nil)
	_ resource.ResourceWithImportState    = (*discountResource)(nil)
	_ resource.ResourceWithValidateConfig = (*discountResource)(nil)
)

func NewDiscountResource() resource.Resource {
	return &discountResource{}
}

type discountResource struct {
	client *polarapi.Client
}

type discountModel struct {
	ID                        types.String `tfsdk:"id"`
	Name                      types.String `tfsdk:"name"`
	Type                      types.String `tfsdk:"type"`
	Duration                  types.String `tfsdk:"duration"`
	DurationInMonths          types.Int64  `tfsdk:"duration_in_months"`
	Amounts                   types.Map    `tfsdk:"amounts"`
	BasisPoints               types.Int64  `tfsdk:"basis_points"`
	Code                      types.String `tfsdk:"code"`
	StartsAt                  types.String `tfsdk:"starts_at"`
	EndsAt                    types.String `tfsdk:"ends_at"`
	MaxRedemptions            types.Int64  `tfsdk:"max_redemptions"`
	MaxRedemptionsPerCustomer types.Int64  `tfsdk:"max_redemptions_per_customer"`
	Products                  types.List   `tfsdk:"products"`
	Metadata                  types.Map    `tfsdk:"metadata"`
	OrganizationID            types.String `tfsdk:"organization_id"`
	RedemptionsCount          types.Int64  `tfsdk:"redemptions_count"`
	CreatedAt                 types.String `tfsdk:"created_at"`
}

func (r *discountResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_discount"
}

func (r *discountResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "A discount customers can redeem at checkout. " +
			"`type` and `duration` are immutable, and the discount value (`amounts`/`basis_points`) " +
			"and `duration_in_months` become immutable after the first redemption.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the discount.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				MarkdownDescription: "Name of the discount, displayed to the customer when applied.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.LengthAtLeast(1),
				},
			},
			"type": schema.StringAttribute{
				MarkdownDescription: "The type of the discount: `fixed` (amount off) or `percentage`. Cannot be changed.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.OneOf("fixed", "percentage"),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"duration": schema.StringAttribute{
				MarkdownDescription: "For subscriptions, how long the discount applies: `once`, `forever` or `repeating`. Cannot be changed.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.OneOf("once", "forever", "repeating"),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"duration_in_months": schema.Int64Attribute{
				MarkdownDescription: "Number of months the discount applies. Required when `duration` is `repeating`; " +
					"forbidden otherwise. Multiply by 12 for yearly pricing.",
				Optional: true,
				Validators: []validator.Int64{
					int64validator.Between(1, 999),
				},
				PlanModifiers: []planmodifier.Int64{
					int64planmodifier.RequiresReplace(),
				},
			},
			"amounts": schema.MapAttribute{
				MarkdownDescription: "Map of currency to fixed amount (in cents) to discount, e.g. `{ usd = 1000 }`. " +
					"Required for `fixed` discounts.",
				Optional:    true,
				ElementType: types.Int64Type,
				Validators: []validator.Map{
					mapvalidator.SizeAtLeast(1),
				},
			},
			"basis_points": schema.Int64Attribute{
				MarkdownDescription: "Discount percentage in basis points (1/100th of a percent): `2550` is 25.5%. " +
					"Required for `percentage` discounts.",
				Optional: true,
				Validators: []validator.Int64{
					int64validator.Between(1, 10000),
				},
			},
			"code": schema.StringAttribute{
				MarkdownDescription: "Code customers type at checkout, 3 to 256 alphanumeric characters. " +
					"Without a code the discount can only be applied via the API.",
				Optional: true,
				Validators: []validator.String{
					stringvalidator.RegexMatches(discountCodeRegex, "must be 3 to 256 alphanumeric characters"),
				},
			},
			"starts_at": schema.StringAttribute{
				MarkdownDescription: "RFC 3339 timestamp after which the discount is redeemable.",
				Optional:            true,
				Validators:          []validator.String{rfc3339Timestamp()},
			},
			"ends_at": schema.StringAttribute{
				MarkdownDescription: "RFC 3339 timestamp after which the discount is no longer redeemable.",
				Optional:            true,
				Validators:          []validator.String{rfc3339Timestamp()},
			},
			"max_redemptions": schema.Int64Attribute{
				MarkdownDescription: "Maximum number of times the discount can be redeemed.",
				Optional:            true,
				Validators:          []validator.Int64{int64validator.AtLeast(1)},
			},
			"max_redemptions_per_customer": schema.Int64Attribute{
				MarkdownDescription: "Maximum number of times a single customer can redeem the discount.",
				Optional:            true,
				Validators:          []validator.Int64{int64validator.AtLeast(1)},
			},
			"products": schema.ListAttribute{
				MarkdownDescription: "IDs of the products the discount is restricted to. " +
					"Omit to let the discount apply to all products.",
				Optional:    true,
				ElementType: types.StringType,
				Validators: []validator.List{
					listvalidator.SizeAtLeast(1),
				},
			},
			"metadata": schema.MapAttribute{
				MarkdownDescription: "Key-value metadata stored on the discount. Values are stored as strings.",
				Optional:            true,
				ElementType:         types.StringType,
			},
			"organization_id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization owning the discount. " +
					"Not needed when authenticating with an organization access token.",
				Optional: true,
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
					stringplanmodifier.RequiresReplace(),
				},
			},
			"redemptions_count": schema.Int64Attribute{
				MarkdownDescription: "Number of times the discount has been redeemed. Refreshed on read.",
				Computed:            true,
				PlanModifiers: []planmodifier.Int64{
					int64planmodifier.UseStateForUnknown(),
				},
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the discount.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

func (r *discountResource) ValidateConfig(ctx context.Context, req resource.ValidateConfigRequest, resp *resource.ValidateConfigResponse) {
	var config discountModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !config.Type.IsUnknown() && !config.Type.IsNull() {
		switch config.Type.ValueString() {
		case "fixed":
			if config.Amounts.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("amounts"),
					"Missing discount amounts",
					"Discounts of type \"fixed\" require the amounts map, e.g. { usd = 1000 }.",
				)
			}
			if !config.BasisPoints.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("basis_points"),
					"Attribute not allowed",
					"basis_points is only allowed for \"percentage\" discounts.",
				)
			}
		case "percentage":
			if config.BasisPoints.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("basis_points"),
					"Missing discount percentage",
					"Discounts of type \"percentage\" require basis_points.",
				)
			}
			if !config.Amounts.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("amounts"),
					"Attribute not allowed",
					"amounts is only allowed for \"fixed\" discounts.",
				)
			}
		}
	}

	if !config.Duration.IsUnknown() && !config.Duration.IsNull() {
		repeating := config.Duration.ValueString() == "repeating"
		if repeating && config.DurationInMonths.IsNull() {
			resp.Diagnostics.AddAttributeError(
				path.Root("duration_in_months"),
				"Missing duration_in_months",
				"duration_in_months is required when duration is \"repeating\".",
			)
		}
		if !repeating && !config.DurationInMonths.IsNull() {
			resp.Diagnostics.AddAttributeError(
				path.Root("duration_in_months"),
				"Attribute not allowed",
				"duration_in_months must be omitted unless duration is \"repeating\".",
			)
		}
	}

	if startsAt, endsAt := parseTimestamp(config.StartsAt), parseTimestamp(config.EndsAt); startsAt != nil && endsAt != nil && !startsAt.Before(*endsAt) {
		resp.Diagnostics.AddAttributeError(
			path.Root("ends_at"),
			"Invalid redeemability window",
			"starts_at must be before ends_at.",
		)
	}
}

func (r *discountResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

func (r *discountResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan discountModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	amounts, diags := amountsToAPI(ctx, plan.Amounts)
	resp.Diagnostics.Append(diags...)
	products, diags := stringListToAPI(ctx, plan.Products)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	discount, err := r.client.CreateDiscount(ctx, polarapi.DiscountCreate{
		Type:                      plan.Type.ValueString(),
		Duration:                  plan.Duration.ValueString(),
		DurationInMonths:          int64Pointer(plan.DurationInMonths),
		Name:                      plan.Name.ValueString(),
		Code:                      stringPointer(plan.Code),
		StartsAt:                  stringPointer(plan.StartsAt),
		EndsAt:                    stringPointer(plan.EndsAt),
		MaxRedemptions:            int64Pointer(plan.MaxRedemptions),
		MaxRedemptionsPerCustomer: int64Pointer(plan.MaxRedemptionsPerCustomer),
		Amounts:                   amounts,
		BasisPoints:               int64Pointer(plan.BasisPoints),
		Products:                  products,
		OrganizationID:            stringPointer(plan.OrganizationID),
		Metadata:                  metadata,
	})
	if err != nil {
		resp.Diagnostics.AddError("Failed to create discount", err.Error())
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, discountToModel(ctx, discount, &plan))...)
}

func (r *discountResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state discountModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	discount, err := r.client.GetDiscount(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read discount", err.Error())
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, discountToModel(ctx, discount, &state))...)
}

func (r *discountResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan discountModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	amounts, diags := amountsToAPI(ctx, plan.Amounts)
	resp.Diagnostics.Append(diags...)
	products, diags := stringListToAPI(ctx, plan.Products)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	if products == nil {
		// The server keeps the product restriction on null and clears it on [].
		products = []string{}
	}

	discount, err := r.client.UpdateDiscount(ctx, plan.ID.ValueString(), polarapi.DiscountUpdate{
		Name:                      stringPointer(plan.Name),
		Code:                      stringPointer(plan.Code),
		StartsAt:                  stringPointer(plan.StartsAt),
		EndsAt:                    stringPointer(plan.EndsAt),
		MaxRedemptions:            int64Pointer(plan.MaxRedemptions),
		MaxRedemptionsPerCustomer: int64Pointer(plan.MaxRedemptionsPerCustomer),
		Amounts:                   amounts,
		BasisPoints:               int64Pointer(plan.BasisPoints),
		Products:                  products,
		Metadata:                  &metadata,
	})
	if err != nil {
		message := err.Error()
		if apiErr, ok := err.(*polarapi.APIError); ok && apiErr.StatusCode == 422 &&
			containsRedeemedError(apiErr.Detail) {
			message += "\n\nThe discount has already been redeemed, so its value (amounts/basis_points) " +
				"and duration_in_months are immutable. Create a new discount for the new value."
		}
		resp.Diagnostics.AddError("Failed to update discount", message)
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, discountToModel(ctx, discount, &plan))...)
}

func (r *discountResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state discountModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if err := r.client.DeleteDiscount(ctx, state.ID.ValueString()); err != nil && !polarapi.IsNotFound(err) {
		resp.Diagnostics.AddError("Failed to delete discount", err.Error())
	}
}

func (r *discountResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func containsRedeemedError(detail string) bool {
	return strings.Contains(detail, "already been redeemed")
}

func amountsToAPI(ctx context.Context, amounts types.Map) (map[string]int64, diag.Diagnostics) {
	var diags diag.Diagnostics
	if amounts.IsNull() || amounts.IsUnknown() {
		return nil, diags
	}
	result := map[string]int64{}
	diags.Append(amounts.ElementsAs(ctx, &result, false)...)
	return result, diags
}

func stringListToAPI(ctx context.Context, list types.List) ([]string, diag.Diagnostics) {
	var diags diag.Diagnostics
	if list.IsNull() || list.IsUnknown() {
		return nil, diags
	}
	var result []string
	diags.Append(list.ElementsAs(ctx, &result, false)...)
	return result, diags
}

func discountToModel(ctx context.Context, discount *polarapi.Discount, prior *discountModel) discountModel {
	metadata := metadataFromAPI(ctx, discount.Metadata)
	if metadata.IsNull() && prior != nil && priorMetadataIsEmptyMap(prior.Metadata) {
		metadata = prior.Metadata
	}

	amounts := types.MapNull(types.Int64Type)
	if discount.Type == "fixed" && len(discount.Amounts) > 0 {
		amounts, _ = types.MapValueFrom(ctx, types.Int64Type, discount.Amounts)
	}

	products := types.ListNull(types.StringType)
	if len(discount.Products) > 0 {
		ids := make([]string, 0, len(discount.Products))
		for _, product := range discount.Products {
			ids = append(ids, product.ID)
		}
		products, _ = types.ListValueFrom(ctx, types.StringType, ids)
	}

	basisPoints := types.Int64Null()
	if discount.Type == "percentage" {
		basisPoints = int64FromPointer(discount.BasisPoints)
	}

	return discountModel{
		ID:                        types.StringValue(discount.ID),
		Name:                      types.StringValue(discount.Name),
		Type:                      types.StringValue(discount.Type),
		Duration:                  types.StringValue(discount.Duration),
		DurationInMonths:          int64FromPointer(discount.DurationInMonths),
		Amounts:                   amounts,
		BasisPoints:               basisPoints,
		Code:                      stringFromPointer(discount.Code),
		StartsAt:                  keepEquivalentTimestamp(prior.StartsAt, discount.StartsAt),
		EndsAt:                    keepEquivalentTimestamp(prior.EndsAt, discount.EndsAt),
		MaxRedemptions:            int64FromPointer(discount.MaxRedemptions),
		MaxRedemptionsPerCustomer: int64FromPointer(discount.MaxRedemptionsPerCustomer),
		Products:                  products,
		Metadata:                  metadata,
		OrganizationID:            types.StringValue(discount.OrganizationID),
		RedemptionsCount:          types.Int64Value(discount.RedemptionsCount),
		CreatedAt:                 types.StringValue(discount.CreatedAt),
	}
}
