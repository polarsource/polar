package provider

import (
	"context"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

func TestMetadataValueToString(t *testing.T) {
	cases := map[any]string{
		"plain":       "plain",
		true:          "true",
		false:         "false",
		float64(5):    "5",
		float64(5.25): "5.25",
	}
	for input, expected := range cases {
		if got := metadataValueToString(input); got != expected {
			t.Errorf("metadataValueToString(%v) = %q, want %q", input, got, expected)
		}
	}
}

func TestMetadataRoundTrip(t *testing.T) {
	ctx := context.Background()
	original, diags := types.MapValueFrom(ctx, types.StringType, map[string]string{"tier": "pro", "count": "3"})
	if diags.HasError() {
		t.Fatal(diags)
	}

	api, diags := metadataToAPI(ctx, original)
	if diags.HasError() {
		t.Fatal(diags)
	}
	if api["tier"] != "pro" || api["count"] != "3" {
		t.Errorf("metadataToAPI = %v", api)
	}

	back := metadataFromAPI(ctx, map[string]any{"tier": "pro", "count": float64(3)})
	if back.IsNull() {
		t.Fatal("expected a non-null map")
	}
	elements := map[string]string{}
	if diags := back.ElementsAs(ctx, &elements, false); diags.HasError() {
		t.Fatal(diags)
	}
	if elements["count"] != "3" {
		t.Errorf("numeric metadata should read back as string, got %q", elements["count"])
	}
}

func TestFilterConversionRoundTrip(t *testing.T) {
	model := &meterFilterModel{
		Conjunction: types.StringValue("and"),
		Clauses: []meterClauseModel{
			{
				Property:    types.StringValue("name"),
				Operator:    types.StringValue("eq"),
				ValueString: types.StringValue("api_call"),
			},
		},
		Groups: []meterGroupModel{
			{
				Conjunction: types.StringValue("or"),
				Clauses: []meterClauseModel{
					{
						Property:    types.StringValue("tokens"),
						Operator:    types.StringValue("gt"),
						ValueNumber: types.Int64Value(100),
					},
					{
						Property:     types.StringValue("cached"),
						Operator:     types.StringValue("eq"),
						ValueBoolean: types.BoolValue(false),
					},
				},
			},
		},
	}

	api := filterToAPI(model)
	if len(api.Clauses) != 2 {
		t.Fatalf("expected 2 top-level nodes (1 leaf + 1 group), got %d", len(api.Clauses))
	}
	if api.Clauses[0].Leaf == nil || api.Clauses[0].Leaf.Value != "api_call" {
		t.Errorf("leaf clause not converted: %+v", api.Clauses[0])
	}
	if api.Clauses[1].Nested == nil || len(api.Clauses[1].Nested.Clauses) != 2 {
		t.Fatalf("group not converted: %+v", api.Clauses[1])
	}
	if api.Clauses[1].Nested.Clauses[0].Leaf.Value != int64(100) {
		t.Errorf("numeric clause should convert to int64, got %T", api.Clauses[1].Nested.Clauses[0].Leaf.Value)
	}

	back, err := filterFromAPI(api)
	if err != nil {
		t.Fatal(err)
	}
	if back.Conjunction.ValueString() != "and" || len(back.Clauses) != 1 || len(back.Groups) != 1 {
		t.Fatalf("round trip lost structure: %+v", back)
	}
	if back.Groups[0].Clauses[0].ValueNumber.ValueInt64() != 100 {
		t.Errorf("numeric value lost in round trip: %+v", back.Groups[0].Clauses[0])
	}
	if back.Groups[0].Clauses[1].ValueBoolean.ValueBool() != false ||
		back.Groups[0].Clauses[1].ValueBoolean.IsNull() {
		t.Errorf("boolean value lost in round trip: %+v", back.Groups[0].Clauses[1])
	}
}

func TestFilterFromAPIRejectsDeepNesting(t *testing.T) {
	deep := polarapi.Filter{
		Conjunction: "and",
		Clauses: []polarapi.FilterNode{
			{Nested: &polarapi.Filter{
				Conjunction: "or",
				Clauses: []polarapi.FilterNode{
					{Nested: &polarapi.Filter{Conjunction: "and"}},
				},
			}},
		},
	}
	if _, err := filterFromAPI(deep); err == nil {
		t.Fatal("expected an error for filters nested more than one level deep")
	}
}

func TestCustomFieldPropertiesFromAPIEmpty(t *testing.T) {
	if got := customFieldPropertiesFromAPI(polarapi.CustomFieldProperties{}, nil); got != nil {
		t.Errorf("empty properties with no prior state should map to nil, got %+v", got)
	}

	prior := &customFieldPropertiesModel{}
	if got := customFieldPropertiesFromAPI(polarapi.CustomFieldProperties{}, prior); got == nil {
		t.Error("empty properties with prior state should keep the empty object")
	}
}

func TestClauseFromAPIValueTypes(t *testing.T) {
	clause, err := clauseFromAPI(polarapi.FilterClause{Property: "p", Operator: "eq", Value: float64(42)})
	if err != nil {
		t.Fatal(err)
	}
	if clause.ValueNumber.ValueInt64() != 42 {
		t.Errorf("float64 API value should map to value_number, got %+v", clause)
	}

	if _, err := clauseFromAPI(polarapi.FilterClause{Property: "p", Operator: "eq", Value: []any{}}); err == nil {
		t.Error("unsupported value types should error")
	}
}
