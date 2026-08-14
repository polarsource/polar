package provider

import (
	"context"
	"fmt"
	"net/http"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/listvalidator"
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
	_ resource.Resource                   = (*benefitResource)(nil)
	_ resource.ResourceWithConfigure      = (*benefitResource)(nil)
	_ resource.ResourceWithImportState    = (*benefitResource)(nil)
	_ resource.ResourceWithValidateConfig = (*benefitResource)(nil)
)

// Benefit types the provider can manage. The remaining types (discord,
// github_repository, feature_flag, slack_shared_channel) depend on
// integrations connected through the dashboard and are not supported yet.
var supportedBenefitTypes = []string{"custom", "meter_credit", "license_keys", "downloadables"}

// Visibility is only configurable for a subset of types; the server forces
// the others to stay public so customers can act on them in the portal.
var visibilityConfigurableBenefitTypes = map[string]bool{
	"custom":       true,
	"meter_credit": true,
	"license_keys": true,
}

func NewBenefitResource() resource.Resource {
	return &benefitResource{}
}

type benefitResource struct {
	client *polarapi.Client
}

type benefitCustomModel struct {
	Note types.String `tfsdk:"note"`
}

type benefitMeterCreditModel struct {
	Units    types.Int64  `tfsdk:"units"`
	Rollover types.Bool   `tfsdk:"rollover"`
	MeterID  types.String `tfsdk:"meter_id"`
}

type benefitLicenseKeysExpiresModel struct {
	TTL       types.Int64  `tfsdk:"ttl"`
	Timeframe types.String `tfsdk:"timeframe"`
}

type benefitLicenseKeysActivationsModel struct {
	Limit               types.Int64 `tfsdk:"limit"`
	EnableCustomerAdmin types.Bool  `tfsdk:"enable_customer_admin"`
}

type benefitLicenseKeysModel struct {
	Prefix      types.String                        `tfsdk:"prefix"`
	LimitUsage  types.Int64                         `tfsdk:"limit_usage"`
	Expires     *benefitLicenseKeysExpiresModel     `tfsdk:"expires"`
	Activations *benefitLicenseKeysActivationsModel `tfsdk:"activations"`
}

type benefitDownloadablesModel struct {
	Files []types.String `tfsdk:"files"`
}

type benefitModel struct {
	ID             types.String               `tfsdk:"id"`
	Type           types.String               `tfsdk:"type"`
	Description    types.String               `tfsdk:"description"`
	Visibility     types.String               `tfsdk:"visibility"`
	Custom         *benefitCustomModel        `tfsdk:"custom"`
	MeterCredit    *benefitMeterCreditModel   `tfsdk:"meter_credit"`
	LicenseKeys    *benefitLicenseKeysModel   `tfsdk:"license_keys"`
	Downloadables  *benefitDownloadablesModel `tfsdk:"downloadables"`
	Metadata       types.Map                  `tfsdk:"metadata"`
	OrganizationID types.String               `tfsdk:"organization_id"`
	Selectable     types.Bool                 `tfsdk:"selectable"`
	Deletable      types.Bool                 `tfsdk:"deletable"`
	CreatedAt      types.String               `tfsdk:"created_at"`
}

func (r *benefitResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_benefit"
}

func (r *benefitResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "A benefit (entitlement) granted to customers of products it is attached to. " +
			"Deleting a benefit revokes it from all customers currently granted it. " +
			"Set exactly the nested attribute matching `type` (e.g. `meter_credit` for type `meter_credit`).",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the benefit.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"type": schema.StringAttribute{
				MarkdownDescription: "The type of the benefit. Cannot be changed after creation. " +
					"Types requiring a dashboard-connected integration (`discord`, `github_repository`, " +
					"`feature_flag`, `slack_shared_channel`) are not supported by this provider yet.",
				Required: true,
				Validators: []validator.String{
					stringvalidator.OneOf(supportedBenefitTypes...),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"description": schema.StringAttribute{
				MarkdownDescription: "The description of the benefit, displayed on products having it. 3 to 42 characters.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.LengthBetween(3, 42),
				},
			},
			"visibility": schema.StringAttribute{
				MarkdownDescription: "Visibility in the customer portal: `draft`, `private` or `public`. " +
					"Only configurable for `custom`, `meter_credit` and `license_keys` benefits; other types stay `public`.",
				Optional: true,
				Computed: true,
				Validators: []validator.String{
					stringvalidator.OneOf("draft", "private", "public"),
				},
			},
			"custom": schema.SingleNestedAttribute{
				MarkdownDescription: "Properties for `custom` benefits.",
				Optional:            true,
				Attributes: map[string]schema.Attribute{
					"note": schema.StringAttribute{
						MarkdownDescription: "A private note shared with customers granted the benefit.",
						Optional:            true,
						Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
					},
				},
			},
			"meter_credit": schema.SingleNestedAttribute{
				MarkdownDescription: "Properties for `meter_credit` benefits, crediting units on a usage meter.",
				Optional:            true,
				Attributes: map[string]schema.Attribute{
					"units": schema.Int64Attribute{
						MarkdownDescription: "The number of units to credit.",
						Required:            true,
						Validators:          []validator.Int64{int64validator.Between(1, 2147483647)},
					},
					"rollover": schema.BoolAttribute{
						MarkdownDescription: "Whether unused credits roll over to the next billing cycle.",
						Required:            true,
					},
					"meter_id": schema.StringAttribute{
						MarkdownDescription: "The ID of the meter to credit.",
						Required:            true,
					},
				},
			},
			"license_keys": schema.SingleNestedAttribute{
				MarkdownDescription: "Properties for `license_keys` benefits.",
				Optional:            true,
				Attributes: map[string]schema.Attribute{
					"prefix": schema.StringAttribute{
						MarkdownDescription: "Prefix prepended to generated license keys.",
						Optional:            true,
						Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
					},
					"limit_usage": schema.Int64Attribute{
						MarkdownDescription: "Maximum number of usages per license key.",
						Optional:            true,
						Validators:          []validator.Int64{int64validator.AtLeast(1)},
					},
					"expires": schema.SingleNestedAttribute{
						MarkdownDescription: "Expiration of generated license keys.",
						Optional:            true,
						Attributes: map[string]schema.Attribute{
							"ttl": schema.Int64Attribute{
								MarkdownDescription: "Time to live, in `timeframe` units.",
								Required:            true,
								Validators:          []validator.Int64{int64validator.AtLeast(1)},
							},
							"timeframe": schema.StringAttribute{
								MarkdownDescription: "The unit of `ttl`: `year`, `month` or `day`.",
								Required:            true,
								Validators: []validator.String{
									stringvalidator.OneOf("year", "month", "day"),
								},
							},
						},
					},
					"activations": schema.SingleNestedAttribute{
						MarkdownDescription: "Activation limits of generated license keys.",
						Optional:            true,
						Attributes: map[string]schema.Attribute{
							"limit": schema.Int64Attribute{
								MarkdownDescription: "Maximum number of simultaneous activations (1 to 50).",
								Required:            true,
								Validators:          []validator.Int64{int64validator.Between(1, 50)},
							},
							"enable_customer_admin": schema.BoolAttribute{
								MarkdownDescription: "Whether customers can deactivate activations in the portal.",
								Required:            true,
							},
						},
					},
				},
			},
			"downloadables": schema.SingleNestedAttribute{
				MarkdownDescription: "Properties for `downloadables` benefits.",
				Optional:            true,
				Attributes: map[string]schema.Attribute{
					"files": schema.ListAttribute{
						MarkdownDescription: "IDs of the downloadable files, uploaded via the files API.",
						Required:            true,
						ElementType:         types.StringType,
						Validators:          []validator.List{listvalidator.SizeAtLeast(1)},
					},
				},
			},
			"metadata": schema.MapAttribute{
				MarkdownDescription: "Key-value metadata stored on the benefit. Values are stored as strings.",
				Optional:            true,
				ElementType:         types.StringType,
			},
			"organization_id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization owning the benefit. " +
					"Not needed when authenticating with an organization access token.",
				Optional: true,
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"selectable": schema.BoolAttribute{
				MarkdownDescription: "Whether the benefit can be attached to products.",
				Computed:            true,
			},
			"deletable": schema.BoolAttribute{
				MarkdownDescription: "Whether the benefit is deletable. Destroying a non-deletable benefit fails.",
				Computed:            true,
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the benefit.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

func (r *benefitResource) ValidateConfig(ctx context.Context, req resource.ValidateConfigRequest, resp *resource.ValidateConfigResponse) {
	var config benefitModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if config.Type.IsUnknown() {
		return
	}
	benefitType := config.Type.ValueString()

	blocks := map[string]bool{
		"custom":        config.Custom != nil,
		"meter_credit":  config.MeterCredit != nil,
		"license_keys":  config.LicenseKeys != nil,
		"downloadables": config.Downloadables != nil,
	}
	for name, set := range blocks {
		if set && name != benefitType {
			resp.Diagnostics.AddAttributeError(
				path.Root(name),
				"Properties do not match the benefit type",
				fmt.Sprintf("The %q attribute is only allowed when type is %q, got %q.", name, name, benefitType),
			)
		}
	}
	// custom and license_keys have no required properties; the other types do.
	if benefitType == "meter_credit" && config.MeterCredit == nil {
		resp.Diagnostics.AddAttributeError(
			path.Root("meter_credit"),
			"Missing benefit properties",
			"Benefits of type \"meter_credit\" require the meter_credit attribute.",
		)
	}
	if benefitType == "downloadables" && config.Downloadables == nil {
		resp.Diagnostics.AddAttributeError(
			path.Root("downloadables"),
			"Missing benefit properties",
			"Benefits of type \"downloadables\" require the downloadables attribute.",
		)
	}

	if !config.Visibility.IsNull() && !config.Visibility.IsUnknown() &&
		!visibilityConfigurableBenefitTypes[benefitType] && config.Visibility.ValueString() != "public" {
		resp.Diagnostics.AddAttributeError(
			path.Root("visibility"),
			"Visibility not configurable for this benefit type",
			fmt.Sprintf("Benefits of type %q always stay public so customers can act on them in the portal.", benefitType),
		)
	}
}

func (r *benefitResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

func (r *benefitResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan benefitModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	benefit, err := r.client.CreateBenefit(ctx, polarapi.BenefitCreate{
		Type:           plan.Type.ValueString(),
		Description:    plan.Description.ValueString(),
		OrganizationID: stringPointer(plan.OrganizationID),
		Visibility:     stringPointer(plan.Visibility),
		Properties:     benefitPropertiesToAPI(&plan),
		Metadata:       metadata,
	})
	if err != nil {
		resp.Diagnostics.AddError("Failed to create benefit", err.Error())
		return
	}

	model, diags := benefitToModel(ctx, benefit, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *benefitResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state benefitModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	benefit, err := r.client.GetBenefit(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read benefit", err.Error())
		return
	}

	model, diags := benefitToModel(ctx, benefit, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *benefitResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan benefitModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	if metadata == nil {
		metadata = map[string]any{}
	}

	update := polarapi.BenefitUpdate{
		Type:        plan.Type.ValueString(),
		Description: stringPointer(plan.Description),
		Properties:  benefitPropertiesToAPI(&plan),
		Metadata:    &metadata,
	}
	if visibilityConfigurableBenefitTypes[plan.Type.ValueString()] {
		update.Visibility = stringPointer(plan.Visibility)
	}

	benefit, err := r.client.UpdateBenefit(ctx, plan.ID.ValueString(), update)
	if err != nil {
		resp.Diagnostics.AddError("Failed to update benefit", err.Error())
		return
	}

	model, diags := benefitToModel(ctx, benefit, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *benefitResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state benefitModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteBenefit(ctx, state.ID.ValueString())
	if err != nil && !polarapi.IsNotFound(err) {
		message := err.Error()
		if apiErr, ok := err.(*polarapi.APIError); ok && apiErr.StatusCode == http.StatusForbidden {
			message += "\n\nThis benefit is not deletable (deletable = false); it is managed automatically by Polar."
		}
		resp.Diagnostics.AddError("Failed to delete benefit", message)
	}
}

func (r *benefitResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func benefitPropertiesToAPI(model *benefitModel) map[string]any {
	properties := map[string]any{}
	switch model.Type.ValueString() {
	case "custom":
		// The update schema (BenefitCustomProperties) requires the note key,
		// nullable — always include it so clearing the note works and updates
		// without a note don't fail validation.
		properties["note"] = nil
		if model.Custom != nil && !model.Custom.Note.IsNull() {
			properties["note"] = model.Custom.Note.ValueString()
		}
	case "meter_credit":
		if model.MeterCredit != nil {
			properties["units"] = model.MeterCredit.Units.ValueInt64()
			properties["rollover"] = model.MeterCredit.Rollover.ValueBool()
			properties["meter_id"] = model.MeterCredit.MeterID.ValueString()
		}
	case "license_keys":
		if model.LicenseKeys != nil {
			if !model.LicenseKeys.Prefix.IsNull() {
				properties["prefix"] = model.LicenseKeys.Prefix.ValueString()
			}
			if !model.LicenseKeys.LimitUsage.IsNull() {
				properties["limit_usage"] = model.LicenseKeys.LimitUsage.ValueInt64()
			}
			if model.LicenseKeys.Expires != nil {
				properties["expires"] = map[string]any{
					"ttl":       model.LicenseKeys.Expires.TTL.ValueInt64(),
					"timeframe": model.LicenseKeys.Expires.Timeframe.ValueString(),
				}
			}
			if model.LicenseKeys.Activations != nil {
				properties["activations"] = map[string]any{
					"limit":                 model.LicenseKeys.Activations.Limit.ValueInt64(),
					"enable_customer_admin": model.LicenseKeys.Activations.EnableCustomerAdmin.ValueBool(),
				}
			}
		}
	case "downloadables":
		if model.Downloadables != nil {
			files := make([]string, 0, len(model.Downloadables.Files))
			for _, file := range model.Downloadables.Files {
				files = append(files, file.ValueString())
			}
			properties["files"] = files
		}
	}
	return properties
}

func benefitPropertiesFromAPI(benefit *polarapi.Benefit, prior *benefitModel) (
	*benefitCustomModel, *benefitMeterCreditModel, *benefitLicenseKeysModel, *benefitDownloadablesModel, error,
) {
	properties := benefit.Properties
	getString := func(key string) types.String {
		if value, ok := properties[key].(string); ok {
			return types.StringValue(value)
		}
		return types.StringNull()
	}
	getInt := func(source map[string]any, key string) types.Int64 {
		if value, ok := source[key].(float64); ok {
			return types.Int64Value(int64(value))
		}
		return types.Int64Null()
	}
	getBool := func(source map[string]any, key string) types.Bool {
		if value, ok := source[key].(bool); ok {
			return types.BoolValue(value)
		}
		return types.BoolNull()
	}

	switch benefit.Type {
	case "custom":
		note := getString("note")
		hadPriorBlock := prior != nil && prior.Custom != nil
		if note.IsNull() && !hadPriorBlock {
			return nil, nil, nil, nil, nil
		}
		return &benefitCustomModel{Note: note}, nil, nil, nil, nil
	case "meter_credit":
		return nil, &benefitMeterCreditModel{
			Units:    getInt(properties, "units"),
			Rollover: getBool(properties, "rollover"),
			MeterID:  getString("meter_id"),
		}, nil, nil, nil
	case "license_keys":
		model := &benefitLicenseKeysModel{
			Prefix:     getString("prefix"),
			LimitUsage: getInt(properties, "limit_usage"),
		}
		if expires, ok := properties["expires"].(map[string]any); ok {
			model.Expires = &benefitLicenseKeysExpiresModel{
				TTL:       getInt(expires, "ttl"),
				Timeframe: types.StringNull(),
			}
			if timeframe, ok := expires["timeframe"].(string); ok {
				model.Expires.Timeframe = types.StringValue(timeframe)
			}
		}
		if activations, ok := properties["activations"].(map[string]any); ok {
			model.Activations = &benefitLicenseKeysActivationsModel{
				Limit:               getInt(activations, "limit"),
				EnableCustomerAdmin: getBool(activations, "enable_customer_admin"),
			}
		}
		hadPriorBlock := prior != nil && prior.LicenseKeys != nil
		if model.Prefix.IsNull() && model.LimitUsage.IsNull() && model.Expires == nil && model.Activations == nil && !hadPriorBlock {
			return nil, nil, nil, nil, nil
		}
		return nil, nil, model, nil, nil
	case "downloadables":
		model := &benefitDownloadablesModel{}
		if files, ok := properties["files"].([]any); ok {
			for _, file := range files {
				if id, ok := file.(string); ok {
					model.Files = append(model.Files, types.StringValue(id))
				}
			}
		}
		return nil, nil, nil, model, nil
	default:
		return nil, nil, nil, nil, fmt.Errorf(
			"benefit type %q is not supported by this provider yet; manage it outside Terraform", benefit.Type,
		)
	}
}

func benefitToModel(ctx context.Context, benefit *polarapi.Benefit, prior *benefitModel) (benefitModel, diag.Diagnostics) {
	var diags diag.Diagnostics

	custom, meterCredit, licenseKeys, downloadables, err := benefitPropertiesFromAPI(benefit, prior)
	if err != nil {
		diags.AddError("Unsupported benefit type", err.Error())
		return benefitModel{}, diags
	}

	metadata := metadataFromAPI(ctx, benefit.Metadata)
	if metadata.IsNull() && prior != nil && priorMetadataIsEmptyMap(prior.Metadata) {
		metadata = prior.Metadata
	}

	return benefitModel{
		ID:             types.StringValue(benefit.ID),
		Type:           types.StringValue(benefit.Type),
		Description:    types.StringValue(benefit.Description),
		Visibility:     types.StringValue(benefit.Visibility),
		Custom:         custom,
		MeterCredit:    meterCredit,
		LicenseKeys:    licenseKeys,
		Downloadables:  downloadables,
		Metadata:       metadata,
		OrganizationID: types.StringValue(benefit.OrganizationID),
		Selectable:     types.BoolValue(benefit.Selectable),
		Deletable:      types.BoolValue(benefit.Deletable),
		CreatedAt:      types.StringValue(benefit.CreatedAt),
	}, diags
}
