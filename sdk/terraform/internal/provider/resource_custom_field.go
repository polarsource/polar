package provider

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/listvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
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
	_ resource.Resource                   = (*customFieldResource)(nil)
	_ resource.ResourceWithConfigure      = (*customFieldResource)(nil)
	_ resource.ResourceWithImportState    = (*customFieldResource)(nil)
	_ resource.ResourceWithValidateConfig = (*customFieldResource)(nil)
)

func NewCustomFieldResource() resource.Resource {
	return &customFieldResource{}
}

type customFieldResource struct {
	client *polarapi.Client
}

type customFieldPropertiesModel struct {
	FormLabel       types.String                   `tfsdk:"form_label"`
	FormHelpText    types.String                   `tfsdk:"form_help_text"`
	FormPlaceholder types.String                   `tfsdk:"form_placeholder"`
	Textarea        types.Bool                     `tfsdk:"textarea"`
	MinLength       types.Int64                    `tfsdk:"min_length"`
	MaxLength       types.Int64                    `tfsdk:"max_length"`
	Ge              types.Int64                    `tfsdk:"ge"`
	Le              types.Int64                    `tfsdk:"le"`
	Options         []customFieldSelectOptionModel `tfsdk:"options"`
}

type customFieldSelectOptionModel struct {
	Value types.String `tfsdk:"value"`
	Label types.String `tfsdk:"label"`
}

type customFieldModel struct {
	ID             types.String                `tfsdk:"id"`
	Type           types.String                `tfsdk:"type"`
	Slug           types.String                `tfsdk:"slug"`
	Name           types.String                `tfsdk:"name"`
	OrganizationID types.String                `tfsdk:"organization_id"`
	Metadata       types.Map                   `tfsdk:"metadata"`
	Properties     *customFieldPropertiesModel `tfsdk:"properties"`
	CreatedAt      types.String                `tfsdk:"created_at"`
}

func (r *customFieldResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_custom_field"
}

func (r *customFieldResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "A custom field collected from customers at checkout. " +
			"Attach it to products with the product's `attached_custom_fields`.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the custom field.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"type": schema.StringAttribute{
				MarkdownDescription: "Data type of the custom field. Cannot be changed after creation.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.OneOf("text", "number", "date", "checkbox", "select"),
				},
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"slug": schema.StringAttribute{
				MarkdownDescription: "Identifier of the custom field, used as the key when storing values. " +
					"Must be unique across the organization. Lowercase letters, digits, hyphens and underscores only.",
				Required: true,
				Validators: []validator.String{
					stringvalidator.RegexMatches(slugRegex, "must contain only lowercase letters, digits, hyphens and underscores"),
				},
			},
			"name": schema.StringAttribute{
				MarkdownDescription: "Name of the custom field.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.LengthAtLeast(1),
				},
			},
			"organization_id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization owning the custom field. " +
					"Not needed when authenticating with an organization access token.",
				Optional: true,
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"metadata": schema.MapAttribute{
				MarkdownDescription: "Key-value metadata stored on the custom field. Values are stored as strings.",
				Optional:            true,
				ElementType:         types.StringType,
			},
			"properties": schema.SingleNestedAttribute{
				MarkdownDescription: "Form properties of the custom field. Which attributes apply depends on `type`.",
				Optional:            true,
				Attributes: map[string]schema.Attribute{
					"form_label": schema.StringAttribute{
						Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
						MarkdownDescription: "Label shown on the checkout form.",
						Optional:            true,
					},
					"form_help_text": schema.StringAttribute{
						Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
						MarkdownDescription: "Help text shown on the checkout form.",
						Optional:            true,
					},
					"form_placeholder": schema.StringAttribute{
						Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
						MarkdownDescription: "Placeholder shown on the checkout form.",
						Optional:            true,
					},
					"textarea": schema.BoolAttribute{
						MarkdownDescription: "Render the field as a textarea. Only for `text` fields.",
						Optional:            true,
					},
					"min_length": schema.Int64Attribute{
						MarkdownDescription: "Minimum length of the value. Only for `text` fields.",
						Optional:            true,
						Validators:          []validator.Int64{int64validator.AtLeast(0)},
					},
					"max_length": schema.Int64Attribute{
						MarkdownDescription: "Maximum length of the value. Only for `text` fields.",
						Optional:            true,
						Validators:          []validator.Int64{int64validator.AtLeast(0)},
					},
					"ge": schema.Int64Attribute{
						MarkdownDescription: "Minimum value (number fields) or Unix timestamp (date fields).",
						Optional:            true,
					},
					"le": schema.Int64Attribute{
						MarkdownDescription: "Maximum value (number fields) or Unix timestamp (date fields).",
						Optional:            true,
					},
					"options": schema.ListNestedAttribute{
						MarkdownDescription: "Available options. Required for `select` fields.",
						Optional:            true,
						Validators:          []validator.List{listvalidator.SizeAtLeast(1)},
						NestedObject: schema.NestedAttributeObject{
							Attributes: map[string]schema.Attribute{
								"value": schema.StringAttribute{
									MarkdownDescription: "Stored value of the option.",
									Required:            true,
									Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
								},
								"label": schema.StringAttribute{
									MarkdownDescription: "Displayed label of the option.",
									Required:            true,
									Validators:          []validator.String{stringvalidator.LengthAtLeast(1)},
								},
							},
						},
					},
				},
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the custom field.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

func (r *customFieldResource) ValidateConfig(ctx context.Context, req resource.ValidateConfigRequest, resp *resource.ValidateConfigResponse) {
	var config customFieldModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if config.Type.IsUnknown() {
		return
	}
	fieldType := config.Type.ValueString()
	properties := config.Properties

	if fieldType == "select" {
		if properties == nil || properties.Options == nil {
			resp.Diagnostics.AddAttributeError(
				path.Root("properties").AtName("options"),
				"Missing select options",
				"Custom fields of type \"select\" require at least one entry in properties.options.",
			)
		}
	}
	if properties == nil {
		return
	}

	requireType := func(attribute string, value interface{ IsNull() bool }, allowed ...string) {
		if value.IsNull() {
			return
		}
		for _, allowedType := range allowed {
			if fieldType == allowedType {
				return
			}
		}
		resp.Diagnostics.AddAttributeError(
			path.Root("properties").AtName(attribute),
			"Property not allowed for this custom field type",
			fmt.Sprintf("properties.%s is only allowed when type is one of %v, got %q.", attribute, allowed, fieldType),
		)
	}
	requireType("textarea", properties.Textarea, "text")
	requireType("min_length", properties.MinLength, "text")
	requireType("max_length", properties.MaxLength, "text")
	requireType("ge", properties.Ge, "number", "date")
	requireType("le", properties.Le, "number", "date")
	if properties.Options != nil && fieldType != "select" {
		resp.Diagnostics.AddAttributeError(
			path.Root("properties").AtName("options"),
			"Property not allowed for this custom field type",
			fmt.Sprintf("properties.options is only allowed when type is \"select\", got %q.", fieldType),
		)
	}
	if !properties.Ge.IsNull() && !properties.Le.IsNull() && properties.Ge.ValueInt64() > properties.Le.ValueInt64() {
		resp.Diagnostics.AddAttributeError(
			path.Root("properties").AtName("le"),
			"Invalid bounds",
			"properties.ge must be less than or equal to properties.le.",
		)
	}
}

func (r *customFieldResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

func (r *customFieldResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan customFieldModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	create := polarapi.CustomFieldCreate{
		Type:           plan.Type.ValueString(),
		Slug:           plan.Slug.ValueString(),
		Name:           plan.Name.ValueString(),
		OrganizationID: stringPointer(plan.OrganizationID),
		Properties:     customFieldPropertiesToAPI(plan.Properties),
		Metadata:       metadata,
	}

	customField, err := r.client.CreateCustomField(ctx, create)
	if err != nil {
		resp.Diagnostics.AddError("Failed to create custom field", err.Error())
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, customFieldToModel(ctx, customField, &plan))...)
}

func (r *customFieldResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state customFieldModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	customField, err := r.client.GetCustomField(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read custom field", err.Error())
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, customFieldToModel(ctx, customField, &state))...)
}

func (r *customFieldResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan customFieldModel
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

	properties := customFieldPropertiesToAPI(plan.Properties)
	update := polarapi.CustomFieldUpdate{
		Type:       plan.Type.ValueString(),
		Slug:       stringPointer(plan.Slug),
		Name:       stringPointer(plan.Name),
		Properties: &properties,
		Metadata:   &metadata,
	}

	customField, err := r.client.UpdateCustomField(ctx, plan.ID.ValueString(), update)
	if err != nil {
		resp.Diagnostics.AddError("Failed to update custom field", err.Error())
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, customFieldToModel(ctx, customField, &plan))...)
}

func (r *customFieldResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state customFieldModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if err := r.client.DeleteCustomField(ctx, state.ID.ValueString()); err != nil && !polarapi.IsNotFound(err) {
		resp.Diagnostics.AddError("Failed to delete custom field", err.Error())
	}
}

func (r *customFieldResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func customFieldPropertiesToAPI(properties *customFieldPropertiesModel) polarapi.CustomFieldProperties {
	if properties == nil {
		return polarapi.CustomFieldProperties{}
	}
	result := polarapi.CustomFieldProperties{
		FormLabel:       stringPointer(properties.FormLabel),
		FormHelpText:    stringPointer(properties.FormHelpText),
		FormPlaceholder: stringPointer(properties.FormPlaceholder),
		Textarea:        boolPointer(properties.Textarea),
		MinLength:       int64Pointer(properties.MinLength),
		MaxLength:       int64Pointer(properties.MaxLength),
		Ge:              int64Pointer(properties.Ge),
		Le:              int64Pointer(properties.Le),
	}
	for _, option := range properties.Options {
		result.Options = append(result.Options, polarapi.CustomFieldSelectOption{
			Value: option.Value.ValueString(),
			Label: option.Label.ValueString(),
		})
	}
	return result
}

func customFieldPropertiesFromAPI(properties polarapi.CustomFieldProperties, prior *customFieldPropertiesModel) *customFieldPropertiesModel {
	model := customFieldPropertiesModel{
		FormLabel:       stringFromPointer(properties.FormLabel),
		FormHelpText:    stringFromPointer(properties.FormHelpText),
		FormPlaceholder: stringFromPointer(properties.FormPlaceholder),
		Textarea:        types.BoolPointerValue(properties.Textarea),
		MinLength:       int64FromPointer(properties.MinLength),
		MaxLength:       int64FromPointer(properties.MaxLength),
		Ge:              int64FromPointer(properties.Ge),
		Le:              int64FromPointer(properties.Le),
	}
	for _, option := range properties.Options {
		model.Options = append(model.Options, customFieldSelectOptionModel{
			Value: types.StringValue(option.Value),
			Label: types.StringValue(option.Label),
		})
	}
	if prior == nil && customFieldPropertiesEmpty(model) {
		return nil
	}
	return &model
}

func customFieldPropertiesEmpty(model customFieldPropertiesModel) bool {
	return model.FormLabel.IsNull() &&
		model.FormHelpText.IsNull() &&
		model.FormPlaceholder.IsNull() &&
		model.Textarea.IsNull() &&
		model.MinLength.IsNull() &&
		model.MaxLength.IsNull() &&
		model.Ge.IsNull() &&
		model.Le.IsNull() &&
		model.Options == nil
}

func customFieldToModel(ctx context.Context, customField *polarapi.CustomField, prior *customFieldModel) customFieldModel {
	metadata := metadataFromAPI(ctx, customField.Metadata)
	if metadata.IsNull() && prior != nil && priorMetadataIsEmptyMap(prior.Metadata) {
		metadata = prior.Metadata
	}
	return customFieldModel{
		ID:             types.StringValue(customField.ID),
		Type:           types.StringValue(customField.Type),
		Slug:           types.StringValue(customField.Slug),
		Name:           types.StringValue(customField.Name),
		OrganizationID: types.StringValue(customField.OrganizationID),
		Metadata:       metadata,
		Properties:     customFieldPropertiesFromAPI(customField.Properties, prior.Properties),
		CreatedAt:      types.StringValue(customField.CreatedAt),
	}
}
