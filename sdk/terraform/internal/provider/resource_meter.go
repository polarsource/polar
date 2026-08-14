package provider

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework-validators/int64validator"
	"github.com/hashicorp/terraform-plugin-framework-validators/listvalidator"
	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	_ resource.Resource                   = (*meterResource)(nil)
	_ resource.ResourceWithConfigure      = (*meterResource)(nil)
	_ resource.ResourceWithImportState    = (*meterResource)(nil)
	_ resource.ResourceWithValidateConfig = (*meterResource)(nil)
)

func NewMeterResource() resource.Resource {
	return &meterResource{}
}

type meterResource struct {
	client *polarapi.Client
}

type meterClauseModel struct {
	Property     types.String `tfsdk:"property"`
	Operator     types.String `tfsdk:"operator"`
	ValueString  types.String `tfsdk:"value_string"`
	ValueNumber  types.Int64  `tfsdk:"value_number"`
	ValueBoolean types.Bool   `tfsdk:"value_boolean"`
}

type meterGroupModel struct {
	Conjunction types.String       `tfsdk:"conjunction"`
	Clauses     []meterClauseModel `tfsdk:"clauses"`
}

type meterFilterModel struct {
	Conjunction types.String       `tfsdk:"conjunction"`
	Clauses     []meterClauseModel `tfsdk:"clauses"`
	Groups      []meterGroupModel  `tfsdk:"groups"`
}

type meterAggregationModel struct {
	Func     types.String `tfsdk:"func"`
	Property types.String `tfsdk:"property"`
}

type meterModel struct {
	ID               types.String           `tfsdk:"id"`
	Name             types.String           `tfsdk:"name"`
	Unit             types.String           `tfsdk:"unit"`
	CustomLabel      types.String           `tfsdk:"custom_label"`
	CustomMultiplier types.Int64            `tfsdk:"custom_multiplier"`
	Filter           *meterFilterModel      `tfsdk:"filter"`
	Aggregation      *meterAggregationModel `tfsdk:"aggregation"`
	Metadata         types.Map              `tfsdk:"metadata"`
	OrganizationID   types.String           `tfsdk:"organization_id"`
	CreatedAt        types.String           `tfsdk:"created_at"`
}

func meterClauseAttributes() map[string]schema.Attribute {
	return map[string]schema.Attribute{
		"property": schema.StringAttribute{
			MarkdownDescription: "The event property to compare. For metadata properties, use the plain key " +
				"without a `metadata.` prefix (the API strips it, which would cause a permanent diff).",
			Required: true,
			Validators: []validator.String{
				stringvalidator.LengthAtLeast(1),
				noMetadataPrefix(),
			},
		},
		"operator": schema.StringAttribute{
			MarkdownDescription: "The comparison operator.",
			Required:            true,
			Validators: []validator.String{
				stringvalidator.OneOf("eq", "ne", "gt", "gte", "lt", "lte", "like", "not_like"),
			},
		},
		"value_string": schema.StringAttribute{
			MarkdownDescription: "String value to compare against. Exactly one of the `value_*` attributes must be set.",
			Optional:            true,
			Validators: []validator.String{
				stringvalidator.LengthAtMost(1000),
			},
		},
		"value_number": schema.Int64Attribute{
			MarkdownDescription: "Integer value to compare against. Exactly one of the `value_*` attributes must be set.",
			Optional:            true,
			Validators: []validator.Int64{
				int64validator.Between(-2147483648, 2147483647),
			},
		},
		"value_boolean": schema.BoolAttribute{
			MarkdownDescription: "Boolean value to compare against. Exactly one of the `value_*` attributes must be set.",
			Optional:            true,
		},
	}
}

func (r *meterResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_meter"
}

func (r *meterResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "A usage-billing meter aggregating ingested events. " +
			"Polar has no meter deletion: destroying this resource archives the meter, " +
			"and archiving fails while the meter is attached to active metered prices or meter-credit benefits. " +
			"The `filter` and `aggregation` become immutable once the meter has billed events.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				MarkdownDescription: "The ID of the meter.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				MarkdownDescription: "The name of the meter, shown on customer invoices and usage pages.",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.LengthAtLeast(3),
				},
			},
			"unit": schema.StringAttribute{
				MarkdownDescription: "The unit of the meter: `scalar` (default), `token` or `custom`.",
				Optional:            true,
				Computed:            true,
				Default:             stringdefault.StaticString("scalar"),
				Validators: []validator.String{
					stringvalidator.OneOf("scalar", "token", "custom"),
				},
			},
			"custom_label": schema.StringAttribute{
				MarkdownDescription: "The label for the custom unit, e.g. `request`. Required when `unit` is `custom`.",
				Optional:            true,
			},
			"custom_multiplier": schema.Int64Attribute{
				MarkdownDescription: "Multiplier from base unit to display scale, e.g. `1000`. Only allowed when `unit` is `custom`.",
				Optional:            true,
				Validators: []validator.Int64{
					int64validator.AtLeast(1),
				},
			},
			"filter": schema.SingleNestedAttribute{
				MarkdownDescription: "The filter selecting which ingested events feed the meter. " +
					"Use `clauses` for flat conditions and `groups` for one level of nested conditions " +
					"(deeper nesting must be managed outside Terraform).",
				Required: true,
				Attributes: map[string]schema.Attribute{
					"conjunction": schema.StringAttribute{
						MarkdownDescription: "How clauses and groups combine: `and` or `or`.",
						Required:            true,
						Validators: []validator.String{
							stringvalidator.OneOf("and", "or"),
						},
					},
					"clauses": schema.ListNestedAttribute{
						MarkdownDescription: "Flat comparison clauses. Omit the attribute instead of passing an empty list.",
						Optional:            true,
						Validators: []validator.List{
							listvalidator.SizeAtLeast(1),
						},
						NestedObject: schema.NestedAttributeObject{
							Attributes: meterClauseAttributes(),
						},
					},
					"groups": schema.ListNestedAttribute{
						MarkdownDescription: "Nested clause groups, one level deep. Omit the attribute instead of passing an empty list.",
						Optional:            true,
						Validators: []validator.List{
							listvalidator.SizeAtLeast(1),
						},
						NestedObject: schema.NestedAttributeObject{
							Attributes: map[string]schema.Attribute{
								"conjunction": schema.StringAttribute{
									MarkdownDescription: "How the group's clauses combine: `and` or `or`.",
									Required:            true,
									Validators: []validator.String{
										stringvalidator.OneOf("and", "or"),
									},
								},
								"clauses": schema.ListNestedAttribute{
									MarkdownDescription: "The group's comparison clauses.",
									Required:            true,
									Validators: []validator.List{
										listvalidator.SizeAtLeast(1),
									},
									NestedObject: schema.NestedAttributeObject{
										Attributes: meterClauseAttributes(),
									},
								},
							},
						},
					},
				},
			},
			"aggregation": schema.SingleNestedAttribute{
				MarkdownDescription: "How matched events aggregate into a quantity.",
				Required:            true,
				Attributes: map[string]schema.Attribute{
					"func": schema.StringAttribute{
						MarkdownDescription: "The aggregation function: `count`, `sum`, `max`, `min`, `avg` or `unique`.",
						Required:            true,
						Validators: []validator.String{
							stringvalidator.OneOf("count", "sum", "max", "min", "avg", "unique"),
						},
					},
					"property": schema.StringAttribute{
						MarkdownDescription: "The event property to aggregate over. Required for every function except `count`. " +
							"For metadata properties, use the plain key without a `metadata.` prefix.",
						Optional: true,
						Validators: []validator.String{
							stringvalidator.LengthAtLeast(1),
							noMetadataPrefix(),
						},
					},
				},
			},
			"metadata": schema.MapAttribute{
				MarkdownDescription: "Key-value metadata stored on the meter. Values are stored as strings.",
				Optional:            true,
				ElementType:         types.StringType,
			},
			"organization_id": schema.StringAttribute{
				MarkdownDescription: "The ID of the organization owning the meter. " +
					"Not needed when authenticating with an organization access token.",
				Optional: true,
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"created_at": schema.StringAttribute{
				MarkdownDescription: "Creation timestamp of the meter.",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

func (r *meterResource) ValidateConfig(ctx context.Context, req resource.ValidateConfigRequest, resp *resource.ValidateConfigResponse) {
	var config meterModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if !config.Unit.IsUnknown() {
		unit := config.Unit.ValueString()
		isCustom := unit == "custom"
		if isCustom && config.CustomLabel.IsNull() {
			resp.Diagnostics.AddAttributeError(
				path.Root("custom_label"),
				"Missing custom unit label",
				"custom_label is required when unit is \"custom\".",
			)
		}
		if !isCustom && !config.Unit.IsNull() {
			if !config.CustomLabel.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("custom_label"),
					"Custom label not allowed",
					"custom_label is only allowed when unit is \"custom\".",
				)
			}
			if !config.CustomMultiplier.IsNull() {
				resp.Diagnostics.AddAttributeError(
					path.Root("custom_multiplier"),
					"Custom multiplier not allowed",
					"custom_multiplier is only allowed when unit is \"custom\".",
				)
			}
		}
	}

	if config.Filter != nil {
		if len(config.Filter.Clauses) == 0 && len(config.Filter.Groups) == 0 {
			resp.Diagnostics.AddAttributeError(
				path.Root("filter"),
				"Empty filter",
				"The filter must contain at least one clause or group.",
			)
		}
		for index, clause := range config.Filter.Clauses {
			validateClauseValue(clause, path.Root("filter").AtName("clauses").AtListIndex(index), resp)
		}
		for groupIndex, group := range config.Filter.Groups {
			for index, clause := range group.Clauses {
				validateClauseValue(clause, path.Root("filter").AtName("groups").AtListIndex(groupIndex).AtName("clauses").AtListIndex(index), resp)
			}
		}
	}

	if config.Aggregation != nil && !config.Aggregation.Func.IsUnknown() {
		function := config.Aggregation.Func.ValueString()
		if function == "count" && !config.Aggregation.Property.IsNull() {
			resp.Diagnostics.AddAttributeError(
				path.Root("aggregation").AtName("property"),
				"Property not allowed",
				"aggregation.property must not be set when func is \"count\".",
			)
		}
		if function != "count" && !config.Aggregation.Func.IsNull() && config.Aggregation.Property.IsNull() {
			resp.Diagnostics.AddAttributeError(
				path.Root("aggregation").AtName("property"),
				"Missing aggregation property",
				fmt.Sprintf("aggregation.property is required when func is %q.", function),
			)
		}
	}
}

func validateClauseValue(clause meterClauseModel, clausePath path.Path, resp *resource.ValidateConfigResponse) {
	set := 0
	for _, isSet := range []bool{
		!clause.ValueString.IsNull() && !clause.ValueString.IsUnknown(),
		!clause.ValueNumber.IsNull() && !clause.ValueNumber.IsUnknown(),
		!clause.ValueBoolean.IsNull() && !clause.ValueBoolean.IsUnknown(),
	} {
		if isSet {
			set++
		}
	}
	if set != 1 {
		resp.Diagnostics.AddAttributeError(
			clausePath,
			"Invalid clause value",
			"Exactly one of value_string, value_number or value_boolean must be set.",
		)
	}
}

func (r *meterResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	r.client = configureClient(req.ProviderData, &resp.Diagnostics)
}

func (r *meterResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan meterModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	metadata, diags := metadataToAPI(ctx, plan.Metadata)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	create := polarapi.MeterCreate{
		Name:             plan.Name.ValueString(),
		Unit:             plan.Unit.ValueString(),
		CustomLabel:      stringPointer(plan.CustomLabel),
		CustomMultiplier: int64Pointer(plan.CustomMultiplier),
		Filter:           filterToAPI(plan.Filter),
		Aggregation:      aggregationToAPI(plan.Aggregation),
		OrganizationID:   stringPointer(plan.OrganizationID),
		Metadata:         metadata,
	}

	meter, err := r.client.CreateMeter(ctx, create)
	if err != nil {
		resp.Diagnostics.AddError("Failed to create meter", err.Error())
		return
	}

	model, diags := meterToModel(ctx, meter, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *meterResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state meterModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	meter, err := r.client.GetMeter(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Failed to read meter", err.Error())
		return
	}

	// An archived meter no longer participates in billing: treat it as
	// destroyed, mirroring the archive-on-destroy semantics below.
	if meter.ArchivedAt != nil {
		resp.State.RemoveResource(ctx)
		return
	}

	model, diags := meterToModel(ctx, meter, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *meterResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan, state meterModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
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

	update := polarapi.MeterUpdate{
		Name:             stringPointer(plan.Name),
		Unit:             stringPointer(plan.Unit),
		CustomLabel:      stringPointer(plan.CustomLabel),
		CustomMultiplier: int64Pointer(plan.CustomMultiplier),
		Metadata:         &metadata,
	}
	// Only send filter/aggregation when they actually change: the server 422s
	// on their mere presence once the meter has billed events, which would
	// otherwise break unrelated updates like a rename.
	planFilter := filterToAPI(plan.Filter)
	if stateFilter := filterToAPI(state.Filter); !reflect.DeepEqual(stateFilter, planFilter) {
		update.Filter = &planFilter
	}
	planAggregation := aggregationToAPI(plan.Aggregation)
	if stateAggregation := aggregationToAPI(state.Aggregation); !reflect.DeepEqual(stateAggregation, planAggregation) {
		update.Aggregation = &planAggregation
	}

	meter, err := r.client.UpdateMeter(ctx, plan.ID.ValueString(), update)
	if err != nil {
		message := err.Error()
		if apiErr, ok := err.(*polarapi.APIError); ok && apiErr.StatusCode == http.StatusUnprocessableEntity &&
			strings.Contains(apiErr.Detail, "already aggregating") {
			message += "\n\nThe meter has started aggregating billed events, so its filter and aggregation " +
				"are immutable. Create a new meter for the new definition and archive this one."
		}
		resp.Diagnostics.AddError("Failed to update meter", message)
		return
	}

	model, diags := meterToModel(ctx, meter, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, model)...)
}

func (r *meterResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state meterModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Polar has no meter deletion; archiving is the terminal state.
	_, err := r.client.ArchiveMeter(ctx, state.ID.ValueString())
	if err != nil {
		if polarapi.IsNotFound(err) {
			return
		}
		message := err.Error()
		if apiErr, ok := err.(*polarapi.APIError); ok && apiErr.StatusCode == http.StatusUnprocessableEntity {
			message += "\n\nA meter cannot be archived while it is attached to active metered product prices " +
				"or meter-credit benefits. Remove those references first (Terraform destroys dependents in " +
				"reverse dependency order when the references are expressed in the configuration)."
		}
		resp.Diagnostics.AddError("Failed to archive meter", message)
	}
}

func (r *meterResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func clauseToAPI(clause meterClauseModel) polarapi.FilterClause {
	var value any
	switch {
	case !clause.ValueString.IsNull():
		value = clause.ValueString.ValueString()
	case !clause.ValueNumber.IsNull():
		value = clause.ValueNumber.ValueInt64()
	case !clause.ValueBoolean.IsNull():
		value = clause.ValueBoolean.ValueBool()
	}
	return polarapi.FilterClause{
		Property: clause.Property.ValueString(),
		Operator: clause.Operator.ValueString(),
		Value:    value,
	}
}

func filterToAPI(filter *meterFilterModel) polarapi.Filter {
	if filter == nil {
		return polarapi.Filter{}
	}
	result := polarapi.Filter{Conjunction: filter.Conjunction.ValueString()}
	for _, clause := range filter.Clauses {
		leaf := clauseToAPI(clause)
		result.Clauses = append(result.Clauses, polarapi.FilterNode{Leaf: &leaf})
	}
	for _, group := range filter.Groups {
		nested := polarapi.Filter{Conjunction: group.Conjunction.ValueString()}
		for _, clause := range group.Clauses {
			leaf := clauseToAPI(clause)
			nested.Clauses = append(nested.Clauses, polarapi.FilterNode{Leaf: &leaf})
		}
		result.Clauses = append(result.Clauses, polarapi.FilterNode{Nested: &nested})
	}
	return result
}

func aggregationToAPI(aggregation *meterAggregationModel) polarapi.Aggregation {
	if aggregation == nil {
		return polarapi.Aggregation{}
	}
	return polarapi.Aggregation{
		Func:     aggregation.Func.ValueString(),
		Property: stringPointer(aggregation.Property),
	}
}

func clauseFromAPI(clause polarapi.FilterClause) (meterClauseModel, error) {
	model := meterClauseModel{
		Property: types.StringValue(clause.Property),
		Operator: types.StringValue(clause.Operator),
	}
	switch value := clause.Value.(type) {
	case string:
		model.ValueString = types.StringValue(value)
	case bool:
		model.ValueBoolean = types.BoolValue(value)
	case float64:
		model.ValueNumber = types.Int64Value(int64(value))
	case int64:
		model.ValueNumber = types.Int64Value(value)
	default:
		return model, fmt.Errorf("unsupported filter clause value type %T", clause.Value)
	}
	return model, nil
}

func filterFromAPI(filter polarapi.Filter) (*meterFilterModel, error) {
	model := meterFilterModel{Conjunction: types.StringValue(filter.Conjunction)}
	for _, node := range filter.Clauses {
		switch {
		case node.Leaf != nil:
			clause, err := clauseFromAPI(*node.Leaf)
			if err != nil {
				return nil, err
			}
			model.Clauses = append(model.Clauses, clause)
		case node.Nested != nil:
			group := meterGroupModel{Conjunction: types.StringValue(node.Nested.Conjunction)}
			for _, nestedNode := range node.Nested.Clauses {
				if nestedNode.Leaf == nil {
					return nil, fmt.Errorf(
						"the meter's filter nests groups more than one level deep, which this provider cannot represent; " +
							"manage this meter outside Terraform or flatten its filter",
					)
				}
				clause, err := clauseFromAPI(*nestedNode.Leaf)
				if err != nil {
					return nil, err
				}
				group.Clauses = append(group.Clauses, clause)
			}
			model.Groups = append(model.Groups, group)
		}
	}
	return &model, nil
}

func meterToModel(ctx context.Context, meter *polarapi.Meter, prior *meterModel) (meterModel, diag.Diagnostics) {
	var diags diag.Diagnostics

	filter, err := filterFromAPI(meter.Filter)
	if err != nil {
		diags.AddError("Unsupported meter filter", err.Error())
		return meterModel{}, diags
	}

	metadata := metadataFromAPI(ctx, meter.Metadata)
	if metadata.IsNull() && prior != nil && priorMetadataIsEmptyMap(prior.Metadata) {
		metadata = prior.Metadata
	}

	aggregation := &meterAggregationModel{
		Func:     types.StringValue(meter.Aggregation.Func),
		Property: stringFromPointer(meter.Aggregation.Property),
	}

	return meterModel{
		ID:               types.StringValue(meter.ID),
		Name:             types.StringValue(meter.Name),
		Unit:             types.StringValue(meter.Unit),
		CustomLabel:      stringFromPointer(meter.CustomLabel),
		CustomMultiplier: int64FromPointer(meter.CustomMultiplier),
		Filter:           filter,
		Aggregation:      aggregation,
		Metadata:         metadata,
		OrganizationID:   types.StringValue(meter.OrganizationID),
		CreatedAt:        types.StringValue(meter.CreatedAt),
	}, diags
}
