package provider

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/tfsdk"
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

func TestURLsEquivalent(t *testing.T) {
	equivalent := [][2]string{
		{"https://example.com", "https://example.com/"},
		{"https://Example.COM/hook", "https://example.com/hook"},
		{"https://example.com:443/hook", "https://example.com/hook"},
		{"https://example.com/hook?a=1", "https://example.com/hook?a=1"},
	}
	for _, pair := range equivalent {
		if !urlsEquivalent(pair[0], pair[1]) {
			t.Errorf("urlsEquivalent(%q, %q) = false, want true", pair[0], pair[1])
		}
	}
	different := [][2]string{
		{"https://example.com/hook", "https://example.com/other"},
		{"https://example.com/hook?a=1", "https://example.com/hook?a=2"},
		{"https://example.com/hook", "https://other.com/hook"},
	}
	for _, pair := range different {
		if urlsEquivalent(pair[0], pair[1]) {
			t.Errorf("urlsEquivalent(%q, %q) = true, want false", pair[0], pair[1])
		}
	}
}

func TestPriorMetadataIsEmptyMap(t *testing.T) {
	ctx := context.Background()
	empty, _ := types.MapValueFrom(ctx, types.StringType, map[string]string{})
	filled, _ := types.MapValueFrom(ctx, types.StringType, map[string]string{"k": "v"})
	if !priorMetadataIsEmptyMap(empty) {
		t.Error("empty known map should qualify")
	}
	if priorMetadataIsEmptyMap(filled) {
		t.Error("map with keys must not qualify: out-of-band deletion must surface as drift")
	}
	if priorMetadataIsEmptyMap(types.MapNull(types.StringType)) {
		t.Error("null map must not qualify")
	}
}

func TestKeepEquivalentTimestamp(t *testing.T) {
	api := "2026-09-01T00:00:00Z"
	prior := types.StringValue("2026-09-01T02:00:00+02:00")
	if got := keepEquivalentTimestamp(prior, &api); got != prior {
		t.Errorf("equivalent instants should keep the configured spelling, got %v", got)
	}
	different := types.StringValue("2026-09-01T03:00:00+02:00")
	if got := keepEquivalentTimestamp(different, &api); got.ValueString() != api {
		t.Errorf("different instants should take the API value, got %v", got)
	}
	if got := keepEquivalentTimestamp(types.StringNull(), nil); !got.IsNull() {
		t.Errorf("nil API value should map to null, got %v", got)
	}
}

func TestBenefitPropertiesRoundTrip(t *testing.T) {
	model := &benefitModel{
		Type: types.StringValue("license_keys"),
		LicenseKeys: &benefitLicenseKeysModel{
			Prefix:     types.StringValue("POLAR"),
			LimitUsage: types.Int64Value(5),
			Expires:    &benefitLicenseKeysExpiresModel{TTL: types.Int64Value(1), Timeframe: types.StringValue("year")},
			Activations: &benefitLicenseKeysActivationsModel{
				Limit:               types.Int64Value(3),
				EnableCustomerAdmin: types.BoolValue(true),
			},
		},
	}
	properties := benefitPropertiesToAPI(model)
	if properties["prefix"] != "POLAR" || properties["limit_usage"] != int64(5) {
		t.Errorf("license_keys properties not converted: %v", properties)
	}

	benefit := &polarapi.Benefit{
		Type: "license_keys",
		Properties: map[string]any{
			"prefix":      "POLAR",
			"limit_usage": float64(5),
			"expires":     map[string]any{"ttl": float64(1), "timeframe": "year"},
			"activations": map[string]any{"limit": float64(3), "enable_customer_admin": true},
		},
	}
	_, _, licenseKeys, _, err := benefitPropertiesFromAPI(benefit, nil)
	if err != nil {
		t.Fatal(err)
	}
	if licenseKeys == nil || licenseKeys.Prefix.ValueString() != "POLAR" ||
		licenseKeys.Expires.Timeframe.ValueString() != "year" ||
		licenseKeys.Activations.Limit.ValueInt64() != 3 {
		t.Errorf("license_keys read-back lost data: %+v", licenseKeys)
	}
}

func TestBenefitCustomNoteAlwaysPresent(t *testing.T) {
	model := &benefitModel{Type: types.StringValue("custom")}
	properties := benefitPropertiesToAPI(model)
	if _, present := properties["note"]; !present {
		t.Fatal("custom properties must always carry the note key: the update schema requires it (nullable)")
	}
	if properties["note"] != nil {
		t.Errorf("unset note should serialize as null, got %v", properties["note"])
	}
}

func TestBenefitUnsupportedTypeErrors(t *testing.T) {
	benefit := &polarapi.Benefit{Type: "discord", Properties: map[string]any{}}
	if _, _, _, _, err := benefitPropertiesFromAPI(benefit, nil); err == nil {
		t.Fatal("unsupported benefit types must error on read")
	}
}

func TestDecimalsEqual(t *testing.T) {
	equal := [][2]string{
		{"0.015", "0.0150"},
		{"1", "1.000000000000"},
		{"0.5", ".5"},
		{"10", "10"},
	}
	for _, pair := range equal {
		if !decimalsEqual(pair[0], pair[1]) {
			t.Errorf("decimalsEqual(%q, %q) = false, want true", pair[0], pair[1])
		}
	}
	different := [][2]string{
		{"0.015", "0.0151"},
		{"1", "10"},
		{"0.015", "not a number"},
	}
	for _, pair := range different {
		if decimalsEqual(pair[0], pair[1]) {
			t.Errorf("decimalsEqual(%q, %q) = true, want false", pair[0], pair[1])
		}
	}
}

func TestKeepEquivalentDecimal(t *testing.T) {
	api := "0.0150"
	prior := types.StringValue("0.015")
	if got := keepEquivalentDecimal(prior, &api); got != prior {
		t.Errorf("an equivalent decimal should keep the configured spelling, got %v", got)
	}
	changed := types.StringValue("0.02")
	if got := keepEquivalentDecimal(changed, &api); got.ValueString() != api {
		t.Errorf("a different decimal should take the API value, got %v", got)
	}
	if got := keepEquivalentDecimal(types.StringNull(), nil); !got.IsNull() {
		t.Errorf("a nil API value should map to null, got %v", got)
	}
}

func TestPriorListIsEmpty(t *testing.T) {
	ctx := context.Background()
	empty, _ := types.ListValueFrom(ctx, types.StringType, []string{})
	filled, _ := types.ListValueFrom(ctx, types.StringType, []string{"a"})
	if !priorListIsEmpty(empty) {
		t.Error("empty known list should qualify")
	}
	if priorListIsEmpty(filled) {
		t.Error("list with elements must not qualify: out-of-band removal must surface as drift")
	}
	if priorListIsEmpty(types.ListNull(types.StringType)) {
		t.Error("null list must not qualify")
	}
}

func testPriceID(id string) types.String {
	if id == "" {
		return types.StringUnknown()
	}
	return types.StringValue(id)
}

func testFixedPrice(id string, amount int64) productPriceModel {
	return productPriceModel{
		ID:            testPriceID(id),
		AmountType:    types.StringValue("fixed"),
		PriceCurrency: types.StringValue("usd"),
		PriceAmount:   types.Int64Value(amount),
	}
}

func testCustomPrice(id string, minimum int64) productPriceModel {
	return productPriceModel{
		ID:            testPriceID(id),
		AmountType:    types.StringValue("custom"),
		PriceCurrency: types.StringValue("usd"),
		MinimumAmount: types.Int64Value(minimum),
	}
}

func testSeatPrice(id string, pricePerSeat int64) productPriceModel {
	return productPriceModel{
		ID:            testPriceID(id),
		AmountType:    types.StringValue("seat_based"),
		PriceCurrency: types.StringValue("usd"),
		SeatTiers: &productSeatTiersModel{
			SeatTierType: types.StringValue("volume"),
			Tiers: []productSeatTierModel{{
				MinSeats:     types.Int64Value(1),
				MaxSeats:     types.Int64Null(),
				PricePerSeat: types.Int64Value(pricePerSeat),
			}},
		},
	}
}

func testMeteredPrice(id, meterID, unitAmount string) productPriceModel {
	return productPriceModel{
		ID:            testPriceID(id),
		AmountType:    types.StringValue("metered_unit"),
		PriceCurrency: types.StringValue("usd"),
		MeterID:       types.StringValue(meterID),
		UnitAmount:    types.StringValue(unitAmount),
	}
}

func TestPricesMatch(t *testing.T) {
	cases := []struct {
		name     string
		planned  productPriceModel
		other    productPriceModel
		mode     priceMatchMode
		expected bool
	}{
		{"fixed same amount, different ID", testFixedPrice("", 990), testFixedPrice("p1", 990), exactPriceMatch, true},
		{"fixed different amount", testFixedPrice("", 990), testFixedPrice("p1", 1990), exactPriceMatch, false},
		{"different amount type", testFixedPrice("", 990), testCustomPrice("p1", 990), exactPriceMatch, false},
		{"custom same minimum", testCustomPrice("", 500), testCustomPrice("p1", 500), exactPriceMatch, true},
		{"custom different minimum", testCustomPrice("", 500), testCustomPrice("p1", 100), exactPriceMatch, false},
		{"seat based same ladder", testSeatPrice("", 1000), testSeatPrice("p1", 1000), exactPriceMatch, true},
		{"seat based different rate", testSeatPrice("", 1000), testSeatPrice("p1", 2000), exactPriceMatch, false},
		{"metered equivalent decimals", testMeteredPrice("", "m1", "0.015"), testMeteredPrice("p1", "m1", "0.0150"), exactPriceMatch, true},
		{"metered different decimals", testMeteredPrice("", "m1", "0.015"), testMeteredPrice("p1", "m1", "0.016"), exactPriceMatch, false},
		{"metered different meter", testMeteredPrice("", "m1", "0.015"), testMeteredPrice("p1", "m2", "0.015"), exactPriceMatch, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := pricesMatch(testCase.planned, testCase.other, testCase.mode); got != testCase.expected {
				t.Errorf("pricesMatch = %v, want %v", got, testCase.expected)
			}
		})
	}
}

func TestPricesMatchTreatsUnknownsPerMode(t *testing.T) {
	// A meter ID resolved during apply: the provider cannot prove the price is
	// unchanged, so it must not keep the existing one...
	planned := testMeteredPrice("", "m1", "0.015")
	planned.MeterID = types.StringUnknown()
	existing := testMeteredPrice("p1", "m1", "0.015")
	if pricesMatch(planned, existing, exactPriceMatch) {
		t.Error("an unknown attribute must never keep an existing price")
	}
	// ... but lining the API's response up with the plan is exactly the case
	// where an unknown is whatever the API just returned.
	if !pricesMatch(planned, existing, responsePriceMatch) {
		t.Error("an unknown attribute should be satisfied by the API's value")
	}
}

func TestMatchPricesToStateConsumesEachStatePriceOnce(t *testing.T) {
	// Two planned prices that both look like the single price in state: only
	// the first may claim it, the second has to be created.
	planned := []productPriceModel{testFixedPrice("", 990), testFixedPrice("", 990)}
	state := []productPriceModel{testFixedPrice("p1", 990)}
	matches := matchPricesToState(planned, state)
	if matches[0] != 0 {
		t.Errorf("the first planned price should claim the state price, got %d", matches[0])
	}
	if matches[1] != -1 {
		t.Errorf("a state price must only back one planned price, got %d", matches[1])
	}
}

func TestPricesToAPIUpdateKeepsMatchedPrices(t *testing.T) {
	state := []productPriceModel{testFixedPrice("p-fixed", 990), testMeteredPrice("p-metered", "m1", "0.015")}
	// The metered price is unchanged (written at a different scale), the fixed
	// price got more expensive, and a seat price was added.
	planned := []productPriceModel{
		testMeteredPrice("", "m1", "0.0150"),
		testFixedPrice("", 1990),
		testSeatPrice("", 1000),
	}

	payload := pricesToAPIUpdate(planned, state)
	if len(payload) != 3 {
		t.Fatalf("expected one entry per planned price, got %d", len(payload))
	}
	if payload[0].ExistingID == nil || *payload[0].ExistingID != "p-metered" {
		t.Errorf("the unchanged metered price should be kept by ID, got %+v", payload[0])
	}
	if payload[1].Create == nil || payload[1].Create.AmountType != "fixed" {
		t.Errorf("the repriced fixed price should be recreated, got %+v", payload[1])
	}
	if payload[2].Create == nil || payload[2].Create.SeatTiers == nil {
		t.Errorf("the added seat price should be created, got %+v", payload[2])
	}
	// The fixed price in state is not referenced, which is how the API is told
	// to archive it.
	for _, entry := range payload {
		if entry.ExistingID != nil && *entry.ExistingID == "p-fixed" {
			t.Error("the repriced fixed price must not be kept by ID")
		}
	}
}

func testNumber(value string) *json.Number {
	number := json.Number(value)
	return &number
}

func testInt64(value int64) *int64 {
	return &value
}

func testString(value string) *string {
	return &value
}

func TestPricesFromAPIFiltersAdHocAndFollowsPlanOrder(t *testing.T) {
	// The API returns catalog prices in its own order (static before metered)
	// and mixes in ad-hoc prices created by Checkout sessions.
	api := []polarapi.ProductPrice{
		{ID: "p-fixed", Source: "catalog", AmountType: "fixed", PriceCurrency: "usd", PriceAmount: testInt64(990)},
		{ID: "p-adhoc", Source: "ad_hoc", AmountType: "fixed", PriceCurrency: "usd", PriceAmount: testInt64(1)},
		{ID: "p-archived", Source: "catalog", AmountType: "fixed", PriceCurrency: "usd", PriceAmount: testInt64(490), IsArchived: true},
		{ID: "p-metered", Source: "catalog", AmountType: "metered_unit", PriceCurrency: "usd", MeterID: testString("m1"), UnitAmount: testNumber("0.0150")},
	}
	prior := []productPriceModel{testMeteredPrice("", "m1", "0.015"), testFixedPrice("", 990)}

	prices, err := pricesFromAPI(api, prior)
	if err != nil {
		t.Fatal(err)
	}
	if len(prices) != 2 {
		t.Fatalf("ad-hoc and archived prices must not enter state, got %d prices", len(prices))
	}
	if prices[0].ID.ValueString() != "p-metered" || prices[1].ID.ValueString() != "p-fixed" {
		t.Errorf("prices should follow the plan's order, got %s then %s",
			prices[0].ID.ValueString(), prices[1].ID.ValueString())
	}
	if prices[0].UnitAmount.ValueString() != "0.015" {
		t.Errorf("the configured decimal spelling should survive the read-back, got %q",
			prices[0].UnitAmount.ValueString())
	}
}

func TestPricesFromAPIAppendsUnplannedPrices(t *testing.T) {
	api := []polarapi.ProductPrice{
		{ID: "p-fixed", Source: "catalog", AmountType: "fixed", PriceCurrency: "usd", PriceAmount: testInt64(990)},
		{ID: "p-extra", Source: "catalog", AmountType: "fixed", PriceCurrency: "eur", PriceAmount: testInt64(900)},
	}
	prices, err := pricesFromAPI(api, []productPriceModel{testFixedPrice("p-fixed", 990)})
	if err != nil {
		t.Fatal(err)
	}
	if len(prices) != 2 || prices[1].ID.ValueString() != "p-extra" {
		t.Fatalf("a price added out of band should append as drift, got %+v", prices)
	}
}

func TestPricesFromAPIRejectsUnrepresentablePrices(t *testing.T) {
	legacy := []polarapi.ProductPrice{
		{ID: "p-legacy", Source: "catalog", AmountType: "fixed", PriceCurrency: "usd", PriceAmount: testInt64(990), Legacy: true},
	}
	if _, err := pricesFromAPI(legacy, nil); err == nil {
		t.Error("legacy recurring prices must error rather than be guessed at")
	}

	unknown := []polarapi.ProductPrice{
		{ID: "p-new", Source: "catalog", AmountType: "metered_tiered", PriceCurrency: "usd"},
	}
	if _, err := pricesFromAPI(unknown, nil); err == nil {
		t.Error("unknown amount types must error rather than be dropped")
	}
}

func TestValidateSeatTiers(t *testing.T) {
	tier := func(min int64, max *int64, price int64) productSeatTierModel {
		return productSeatTierModel{
			MinSeats:     types.Int64Value(min),
			MaxSeats:     int64FromPointer(max),
			PricePerSeat: types.Int64Value(price),
		}
	}
	cases := []struct {
		name   string
		tiers  []productSeatTierModel
		errors bool
	}{
		{"contiguous", []productSeatTierModel{tier(1, testInt64(10), 1000), tier(11, nil, 800)}, false},
		{"gap", []productSeatTierModel{tier(1, testInt64(10), 1000), tier(12, nil, 800)}, true},
		{"overlap", []productSeatTierModel{tier(1, testInt64(10), 1000), tier(5, nil, 800)}, true},
		{"unbounded tier is not last", []productSeatTierModel{tier(1, nil, 1000), tier(11, nil, 800)}, true},
		{"single unbounded tier", []productSeatTierModel{tier(1, nil, 1000)}, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			resp := &resource.ValidateConfigResponse{}
			validateSeatTiers(testCase.tiers, path.Root("prices"), resp)
			if resp.Diagnostics.HasError() != testCase.errors {
				t.Errorf("HasError = %v, want %v (%v)", resp.Diagnostics.HasError(), testCase.errors, resp.Diagnostics)
			}
		})
	}
}

func TestMeterIntervalDividesBillingInterval(t *testing.T) {
	cases := []struct {
		meterInterval   string
		meterCount      int64
		billingInterval string
		billingCount    int64
		expected        bool
	}{
		{"month", 1, "year", 1, true},
		{"month", 5, "year", 1, false},
		{"month", 1, "month", 3, true},
		{"month", 2, "month", 3, false},
		{"day", 1, "year", 1, true},
		{"day", 2, "year", 1, false},
		{"day", 7, "week", 2, true},
		{"year", 1, "month", 1, false},
		{"week", 1, "month", 1, false},
	}
	for _, testCase := range cases {
		got := meterIntervalDividesBillingInterval(
			testCase.meterInterval, testCase.meterCount, testCase.billingInterval, testCase.billingCount)
		if got != testCase.expected {
			t.Errorf("%s x%d on %s x%d = %v, want %v",
				testCase.meterInterval, testCase.meterCount,
				testCase.billingInterval, testCase.billingCount, got, testCase.expected)
		}
	}
}

func TestUnitAmountValidator(t *testing.T) {
	valid := []string{"0.015", "1", "12.000000000001", "0.000000000001"}
	for _, value := range valid {
		resp := &validator.StringResponse{}
		unitAmount().ValidateString(context.Background(), validator.StringRequest{
			Path:        path.Root("unit_amount"),
			ConfigValue: types.StringValue(value),
		}, resp)
		if resp.Diagnostics.HasError() {
			t.Errorf("%q should be a valid unit amount: %v", value, resp.Diagnostics)
		}
	}
	invalid := []string{"0", "0.000", "-1", "1e-3", "0.0000000000001", "abc", ""}
	for _, value := range invalid {
		resp := &validator.StringResponse{}
		unitAmount().ValidateString(context.Background(), validator.StringRequest{
			Path:        path.Root("unit_amount"),
			ConfigValue: types.StringValue(value),
		}, resp)
		if !resp.Diagnostics.HasError() {
			t.Errorf("%q should be rejected as a unit amount", value)
		}
	}
}

func TestStrippedStringValidator(t *testing.T) {
	resp := &validator.StringResponse{}
	strippedString().ValidateString(context.Background(), validator.StringRequest{
		Path:        path.Root("name"),
		ConfigValue: types.StringValue(" Pro "),
	}, resp)
	if !resp.Diagnostics.HasError() {
		t.Error("surrounding whitespace must be rejected: the API strips it, leaving a permanent diff")
	}
}

func TestResourceSchemasAreValid(t *testing.T) {
	ctx := context.Background()
	for _, newResource := range New("test")().Resources(ctx) {
		resp := &resource.SchemaResponse{}
		newResource().Schema(ctx, resource.SchemaRequest{}, resp)
		if resp.Diagnostics.HasError() {
			t.Fatalf("schema construction failed: %v", resp.Diagnostics)
		}
		metadataResp := &resource.MetadataResponse{}
		newResource().Metadata(ctx, resource.MetadataRequest{ProviderTypeName: "polar"}, metadataResp)
		if diags := resp.Schema.ValidateImplementation(ctx); diags.HasError() {
			t.Errorf("%s has an invalid schema: %v", metadataResp.TypeName, diags)
		}
	}
}

func TestPlannedPriceIDs(t *testing.T) {
	state := []productPriceModel{testFixedPrice("p-fixed", 990), testMeteredPrice("p-metered", "m1", "0.015")}
	// The metered price is unchanged, the fixed price was repriced, and a
	// custom price was added.
	planned := []productPriceModel{
		testMeteredPrice("", "m1", "0.0150"),
		testFixedPrice("", 1990),
		testCustomPrice("", 500),
	}

	ids := plannedPriceIDs(planned, state)
	if ids[0].ValueString() != "p-metered" {
		t.Errorf("an unchanged price should keep its ID in the plan, got %v", ids[0])
	}
	if !ids[1].IsUnknown() || !ids[2].IsUnknown() {
		t.Errorf("recreated and added prices should plan an unknown ID, got %v and %v", ids[1], ids[2])
	}
}

// productResourceSchema returns the real resource schema so the tests below
// exercise the same attribute types Terraform sends.
func productResourceSchema(t *testing.T) schema.Schema {
	t.Helper()
	resp := &resource.SchemaResponse{}
	(&productResource{}).Schema(context.Background(), resource.SchemaRequest{}, resp)
	if resp.Diagnostics.HasError() {
		t.Fatal(resp.Diagnostics)
	}
	return resp.Schema
}

func productPriceObjectType(t *testing.T) types.ObjectType {
	t.Helper()
	objectType, ok := productResourceSchema(t).Type().(types.ObjectType)
	if !ok {
		t.Fatal("the product schema should be an object type")
	}
	listType, ok := objectType.AttrTypes["prices"].(types.ListType)
	if !ok {
		t.Fatal("prices should be a list type")
	}
	priceType, ok := listType.ElemType.(types.ObjectType)
	if !ok {
		t.Fatal("a price should be an object type")
	}
	return priceType
}

// nullObjectValues fills every attribute of an object type with its null
// value; ValueType returns the zero value of each type, which is null but
// carries the element and attribute types nested values need.
func nullObjectValues(ctx context.Context, attributeTypes map[string]attr.Type) map[string]attr.Value {
	values := make(map[string]attr.Value, len(attributeTypes))
	for name, attributeType := range attributeTypes {
		values[name] = attributeType.ValueType(ctx)
	}
	return values
}

func testObject(t *testing.T, objectType types.ObjectType, overrides map[string]attr.Value) types.Object {
	t.Helper()
	ctx := context.Background()
	values := nullObjectValues(ctx, objectType.AttrTypes)
	for name, value := range overrides {
		values[name] = value
	}
	object, diags := types.ObjectValue(objectType.AttrTypes, values)
	if diags.HasError() {
		t.Fatal(diags)
	}
	return object
}

func testList(t *testing.T, elementType attr.Type, elements ...attr.Value) types.List {
	t.Helper()
	list, diags := types.ListValue(elementType, elements)
	if diags.HasError() {
		t.Fatal(diags)
	}
	return list
}

// testProductConfig builds a product configuration from the real schema, with
// every attribute null except the ones given.
func testProductConfig(t *testing.T, overrides map[string]attr.Value) tfsdk.Config {
	t.Helper()
	ctx := context.Background()
	productSchema := productResourceSchema(t)
	objectType := productSchema.Type().(types.ObjectType)
	raw, err := testObject(t, objectType, overrides).ToTerraformValue(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return tfsdk.Config{Raw: raw, Schema: productSchema}
}

func TestValidateConfigSkipsUnknownCollections(t *testing.T) {
	ctx := context.Background()
	priceType := productPriceObjectType(t)
	seatTiersType := priceType.AttrTypes["seat_tiers"].(types.ObjectType)
	tiersType := seatTiersType.AttrTypes["tiers"].(types.ListType)

	fixedPrice := testObject(t, priceType, map[string]attr.Value{
		"amount_type":  types.StringValue("fixed"),
		"price_amount": types.Int64Value(990),
	})
	customFieldsType := productResourceSchema(t).Type().(types.ObjectType).
		AttrTypes["attached_custom_fields"].(types.ListType)

	cases := map[string]map[string]attr.Value{
		// `prices = var.prices` in a reusable module: every variable is
		// unknown during `terraform validate`.
		"unknown price list": {"prices": types.ListUnknown(priceType)},
		"unknown price element": {
			"prices": testList(t, priceType, types.ObjectUnknown(priceType.AttrTypes)),
		},
		"unknown seat tiers": {
			"prices": testList(t, priceType, testObject(t, priceType, map[string]attr.Value{
				"amount_type": types.StringValue("seat_based"),
				"seat_tiers":  types.ObjectUnknown(seatTiersType.AttrTypes),
			})),
		},
		"unknown tiers list": {
			"prices": testList(t, priceType, testObject(t, priceType, map[string]attr.Value{
				"amount_type": types.StringValue("seat_based"),
				"seat_tiers": testObject(t, seatTiersType, map[string]attr.Value{
					"seat_tier_type": types.StringValue("volume"),
					"tiers":          types.ListUnknown(tiersType.ElemType),
				}),
			})),
		},
		"unknown attached custom fields": {
			"prices":                 testList(t, priceType, fixedPrice),
			"attached_custom_fields": types.ListUnknown(customFieldsType.ElemType),
		},
	}

	for name, overrides := range cases {
		t.Run(name, func(t *testing.T) {
			resp := &resource.ValidateConfigResponse{}
			(&productResource{}).ValidateConfig(ctx,
				resource.ValidateConfigRequest{Config: testProductConfig(t, overrides)}, resp)
			if resp.Diagnostics.HasError() {
				t.Fatalf("a collection the configuration cannot describe yet must skip validation, "+
					"not fail it: %v", resp.Diagnostics)
			}
		})
	}
}

func TestValidateConfigStillCatchesKnownMistakes(t *testing.T) {
	priceType := productPriceObjectType(t)
	// A metered price on a one-time product, with the fixed price's attribute
	// set on it: both are plan-time errors.
	broken := testObject(t, priceType, map[string]attr.Value{
		"amount_type":  types.StringValue("metered_unit"),
		"meter_id":     types.StringValue("00000000-0000-0000-0000-000000000001"),
		"unit_amount":  types.StringValue("0.015"),
		"price_amount": types.Int64Value(990),
	})

	resp := &resource.ValidateConfigResponse{}
	(&productResource{}).ValidateConfig(context.Background(), resource.ValidateConfigRequest{
		Config: testProductConfig(t, map[string]attr.Value{"prices": testList(t, priceType, broken)}),
	}, resp)
	if !resp.Diagnostics.HasError() {
		t.Fatal("fully known prices must still be validated")
	}
}

func testPricesPlanRequest(t *testing.T, plan, state types.List) planmodifier.ListRequest {
	t.Helper()
	config := testProductConfig(t, nil)
	return planmodifier.ListRequest{
		Path:        path.Root("prices"),
		Config:      config,
		ConfigValue: plan,
		Plan:        tfsdk.Plan{Raw: config.Raw, Schema: config.Schema},
		PlanValue:   plan,
		State:       tfsdk.State{Raw: config.Raw, Schema: config.Schema},
		StateValue:  state,
	}
}

func testPlannedPriceIDs(t *testing.T, plan, state types.List) []attr.Value {
	t.Helper()
	resp := &planmodifier.ListResponse{PlanValue: plan}
	keepMatchedPriceIDs().PlanModifyList(context.Background(), testPricesPlanRequest(t, plan, state), resp)
	if resp.Diagnostics.HasError() {
		t.Fatalf("planning prices must not fail: %v", resp.Diagnostics)
	}
	ids := make([]attr.Value, 0, len(resp.PlanValue.Elements()))
	for _, element := range resp.PlanValue.Elements() {
		object, ok := element.(types.Object)
		if !ok || object.IsUnknown() || object.IsNull() {
			ids = append(ids, types.StringUnknown())
			continue
		}
		ids = append(ids, object.Attributes()["id"])
	}
	return ids
}

func TestKeepMatchedPriceIDsKeepsUnchangedPrices(t *testing.T) {
	priceType := productPriceObjectType(t)
	fixed := func(id string, amount int64) types.Object {
		return testObject(t, priceType, map[string]attr.Value{
			"id":             types.StringValue(id),
			"amount_type":    types.StringValue("fixed"),
			"price_currency": types.StringValue("usd"),
			"price_amount":   types.Int64Value(amount),
		})
	}
	metered := func(id string) types.Object {
		return testObject(t, priceType, map[string]attr.Value{
			"id":             types.StringValue(id),
			"amount_type":    types.StringValue("metered_unit"),
			"price_currency": types.StringValue("usd"),
			"meter_id":       types.StringValue("m1"),
			"unit_amount":    types.StringValue("0.015"),
		})
	}
	unknownID := func(object types.Object) types.Object {
		return testObject(t, priceType, mergeAttributes(object.Attributes(), map[string]attr.Value{
			"id": types.StringUnknown(),
		}))
	}

	state := testList(t, priceType, fixed("p-fixed", 990), metered("p-metered"))
	// The prices were reordered and the fixed one repriced; the framework has
	// already blanked every ID because the product changed.
	plan := testList(t, priceType, unknownID(metered("")), unknownID(fixed("", 1990)))

	ids := testPlannedPriceIDs(t, plan, state)
	if ids[0].(types.String).ValueString() != "p-metered" {
		t.Errorf("a reordered but unchanged price should keep its ID, got %v", ids[0])
	}
	if !ids[1].IsUnknown() {
		t.Errorf("a repriced price is archived and recreated, so its ID must be unknown, got %v", ids[1])
	}
}

func TestKeepMatchedPriceIDsBlanksIDsItCannotMatch(t *testing.T) {
	priceType := productPriceObjectType(t)
	seatTiersType := priceType.AttrTypes["seat_tiers"].(types.ObjectType)

	state := testList(t, priceType, testObject(t, priceType, map[string]attr.Value{
		"id":             types.StringValue("p-existing"),
		"amount_type":    types.StringValue("fixed"),
		"price_currency": types.StringValue("usd"),
		"price_amount":   types.Int64Value(990),
	}))
	// Terraform fills a list of nested attributes by index, so a price can
	// arrive carrying the previous occupant's ID. With a seat ladder that is
	// only known after apply the provider cannot tell whether it is the same
	// price, and leaving that ID in place would pin the update to the wrong
	// one.
	plan := testList(t, priceType, testObject(t, priceType, map[string]attr.Value{
		"id":             types.StringValue("p-existing"),
		"amount_type":    types.StringValue("seat_based"),
		"price_currency": types.StringValue("usd"),
		"seat_tiers":     types.ObjectUnknown(seatTiersType.AttrTypes),
	}))

	ids := testPlannedPriceIDs(t, plan, state)
	if !ids[0].IsUnknown() {
		t.Errorf("an ID the provider cannot match must be blanked, got %v", ids[0])
	}
}

func TestKeepMatchedPriceIDsHandlesUnknownElements(t *testing.T) {
	priceType := productPriceObjectType(t)
	state := testList(t, priceType, testObject(t, priceType, map[string]attr.Value{
		"id":             types.StringValue("p-existing"),
		"amount_type":    types.StringValue("fixed"),
		"price_currency": types.StringValue("usd"),
		"price_amount":   types.Int64Value(990),
	}))
	plan := testList(t, priceType,
		types.ObjectUnknown(priceType.AttrTypes),
		testObject(t, priceType, map[string]attr.Value{
			"id":             types.StringValue("p-existing"),
			"amount_type":    types.StringValue("fixed"),
			"price_currency": types.StringValue("usd"),
			"price_amount":   types.Int64Value(990),
		}),
	)

	ids := testPlannedPriceIDs(t, plan, state)
	for index, id := range ids {
		if !id.IsUnknown() {
			t.Errorf("price %d: a plan containing an unknown price must blank every ID, got %v", index, id)
		}
	}
}

func mergeAttributes(base, overrides map[string]attr.Value) map[string]attr.Value {
	merged := make(map[string]attr.Value, len(base))
	for name, value := range base {
		merged[name] = value
	}
	for name, value := range overrides {
		merged[name] = value
	}
	return merged
}

func TestCollectionsKnown(t *testing.T) {
	objectType := types.ObjectType{AttrTypes: map[string]attr.Type{"name": types.StringType}}
	known := testObject(t, objectType, map[string]attr.Value{"name": types.StringValue("a")})
	unknownLeaf := testObject(t, objectType, map[string]attr.Value{"name": types.StringUnknown()})

	if !collectionsKnown(testList(t, objectType, known, unknownLeaf)) {
		t.Error("an unknown leaf is representable: types.String carries it")
	}
	if collectionsKnown(types.ListUnknown(objectType)) {
		t.Error("an unknown list has no Go representation")
	}
	if collectionsKnown(testList(t, objectType, types.ObjectUnknown(objectType.AttrTypes))) {
		t.Error("an unknown element has no Go representation")
	}
	if collectionsKnown(testList(t, objectType, types.ObjectNull(objectType.AttrTypes))) {
		t.Error("a null element cannot be reflected into a struct value")
	}
	nested := types.ObjectType{AttrTypes: map[string]attr.Type{"inner": objectType}}
	if collectionsKnown(testObject(t, nested, map[string]attr.Value{
		"inner": types.ObjectUnknown(objectType.AttrTypes),
	})) {
		t.Error("an unknown nested object has no Go representation")
	}
	if !collectionsKnown(testObject(t, nested, map[string]attr.Value{
		"inner": types.ObjectNull(objectType.AttrTypes),
	})) {
		t.Error("a null nested object is representable: it maps to a nil pointer")
	}
}

func TestKeepEquivalentURL(t *testing.T) {
	api := "https://example.com/"
	prior := types.StringValue("https://example.com")
	if got := keepEquivalentURL(prior, &api); got != prior {
		t.Errorf("an equivalent URL should keep the configured spelling, got %v", got)
	}
	changed := types.StringValue("https://other.example.com")
	if got := keepEquivalentURL(changed, &api); got.ValueString() != api {
		t.Errorf("a different URL should take the API value, got %v", got)
	}
	if got := keepEquivalentURL(types.StringNull(), nil); !got.IsNull() {
		t.Errorf("a nil API value should map to null, got %v", got)
	}
	if got := keepEquivalentURL(types.StringNull(), &api); got.ValueString() != api {
		t.Errorf("no prior spelling should take the API value, got %v", got)
	}
}

func TestBoolOrAndFriends(t *testing.T) {
	if !boolOr(types.BoolNull(), true) {
		t.Error("an undeclared boolean must keep the API's value")
	}
	if boolOr(types.BoolValue(false), true) {
		t.Error("a declared boolean must win over the API's value")
	}
	if int64Or(types.Int64Null(), 7) != 7 || int64Or(types.Int64Value(1), 7) != 1 {
		t.Error("int64Or should prefer a declared value and fall back to the API's")
	}
	if stringOr(types.StringNull(), "a") != "a" || stringOr(types.StringValue("b"), "a") != "b" {
		t.Error("stringOr should prefer a declared value and fall back to the API's")
	}
	current := true
	if boolPointerOr(types.BoolNull(), nil) != nil {
		t.Error("an undeclared boolean must keep the API's absent key absent")
	}
	if got := boolPointerOr(types.BoolNull(), &current); got == nil || !*got {
		t.Error("an undeclared boolean must keep the API's pointer")
	}
	if got := boolPointerOr(types.BoolValue(false), &current); got == nil || *got {
		t.Error("a declared boolean must win over the API's pointer")
	}
}

// testOrganization is the API's view of an organization whose settings were all
// changed away from their defaults, so a payload that carries a default has
// clearly reset something it should have left alone.
func testOrganization() *polarapi.Organization {
	pause, allowEmailChange, autoAccept := true, true, int64(500)
	return &polarapi.Organization{
		ID:                         "org-1",
		Slug:                       "acme",
		Status:                     "active",
		CreatedAt:                  "2026-01-01T00:00:00Z",
		Name:                       "Acme",
		Website:                    testString("https://acme.example.com/"),
		EmbedHosts:                 []string{"acme.example.com"},
		DefaultPresentmentCurrency: "eur",
		DefaultTaxBehavior:         "inclusive",
		FeatureSettings: &polarapi.OrganizationFeatureSettings{
			SeatBasedPricingEnabled: true,
			MemberModelEnabled:      true,
			OverviewMetrics:         []string{"revenue"},
		},
		SubscriptionSettings: polarapi.OrganizationSubscriptionSettings{
			AllowMultipleSubscriptions:   true,
			ProrationBehavior:            "invoice",
			BenefitRevocationGracePeriod: 3,
			PreventTrialAbuse:            true,
			AllowCustomerUpdates:         false,
		},
		CustomerEmailSettings: polarapi.OrganizationCustomerEmailSettings{
			OrderConfirmation:   true,
			SubscriptionPaused:  true,
			SubscriptionUpdated: true,
		},
		CustomerPortalSettings: polarapi.OrganizationCustomerPortalSettings{
			Usage:        polarapi.OrganizationCustomerPortalUsageSettings{Show: true},
			Subscription: polarapi.OrganizationCustomerPortalSubscriptionSettings{UpdateSeats: true, UpdatePlan: true, Pause: &pause},
			Customer:     &polarapi.OrganizationCustomerPortalCustomerSettings{AllowEmailChange: &allowEmailChange},
		},
		DisputeSettings: polarapi.OrganizationDisputeSettings{AutoAcceptBelowAmount: &autoAccept},
	}
}

func testOrganizationUpdatePayload(t *testing.T, config *organizationModel) map[string]any {
	t.Helper()
	update, diags := organizationUpdateFromConfig(context.Background(), config, testOrganization())
	if diags.HasError() {
		t.Fatal(diags)
	}
	encoded, err := json.Marshal(update)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	return payload
}

// TestOrganizationUpdateFromConfigSendsNothingForAnEmptyConfig is the heart of
// the singleton's contract: a resource that declares no settings adopts the
// organization and touches nothing at all.
func TestOrganizationUpdateFromConfigSendsNothingForAnEmptyConfig(t *testing.T) {
	config := &organizationModel{
		EmbedHosts: types.SetNull(types.StringType),
	}
	update, diags := organizationUpdateFromConfig(context.Background(), config, testOrganization())
	if diags.HasError() {
		t.Fatal(diags)
	}
	if !update.IsEmpty() {
		t.Errorf("an empty configuration must produce an empty update, got %+v", update)
	}
}

func TestOrganizationUpdateFromConfigSendsOnlyDeclaredAttributes(t *testing.T) {
	config := &organizationModel{
		Name:       types.StringValue("Acme Inc"),
		EmbedHosts: types.SetNull(types.StringType),
	}
	payload := testOrganizationUpdatePayload(t, config)
	if len(payload) != 1 || payload["name"] != "Acme Inc" {
		t.Errorf("only the declared name should be sent, got %v", payload)
	}
}

// TestOrganizationUpdateFromConfigCompletesReplacedSettings covers the three
// settings objects the server replaces wholesale instead of merging: the
// payload has to carry every key, and the ones the configuration leaves out
// must come from the organization rather than from a Go zero value.
func TestOrganizationUpdateFromConfigCompletesReplacedSettings(t *testing.T) {
	ctx := context.Background()
	config := &organizationModel{
		EmbedHosts: types.SetNull(types.StringType),
		SubscriptionSettings: &organizationSubscriptionSettingsModel{
			ProrationBehavior: types.StringValue("prorate"),
		},
		CustomerEmailSettings: &organizationCustomerEmailSettingsModel{
			SubscriptionPaused: types.BoolValue(false),
		},
		CustomerPortalSettings: &organizationCustomerPortalSettingsModel{
			Usage: &organizationCustomerPortalUsageModel{Show: types.BoolValue(false)},
		},
	}

	update, diags := organizationUpdateFromConfig(ctx, config, testOrganization())
	if diags.HasError() {
		t.Fatal(diags)
	}

	subscription := update.SubscriptionSettings
	if subscription == nil || subscription.ProrationBehavior != "prorate" {
		t.Fatalf("the declared proration behavior should be sent, got %+v", subscription)
	}
	if !subscription.AllowMultipleSubscriptions || subscription.BenefitRevocationGracePeriod != 3 {
		t.Errorf("undeclared subscription settings must keep the organization's values, got %+v", subscription)
	}
	if !subscription.PreventTrialAbuse || subscription.AllowCustomerUpdates {
		t.Errorf("settings this resource does not expose must round-trip unchanged, got %+v", subscription)
	}

	emails := update.CustomerEmailSettings
	if emails == nil || emails.SubscriptionPaused {
		t.Fatalf("the declared email toggle should be sent, got %+v", emails)
	}
	if !emails.OrderConfirmation || !emails.SubscriptionUpdated {
		t.Errorf("undeclared email toggles must keep the organization's values, got %+v", emails)
	}

	portal := update.CustomerPortalSettings
	if portal == nil || portal.Usage.Show {
		t.Fatalf("the declared portal toggle should be sent, got %+v", portal)
	}
	if !portal.Subscription.UpdateSeats || portal.Subscription.Pause == nil || !*portal.Subscription.Pause {
		t.Errorf("an undeclared portal sub-object must keep the organization's values, got %+v", portal.Subscription)
	}
	if portal.Customer == nil || portal.Customer.AllowEmailChange == nil || !*portal.Customer.AllowEmailChange {
		t.Error("the optional customer sub-object must survive: the server drops what the payload omits")
	}
}

// TestOrganizationUpdateFromConfigMergesMergedSettings covers the two settings
// objects the server merges key by key: only the declared keys may be sent, so
// the staff-managed feature settings keep their values.
func TestOrganizationUpdateFromConfigMergesMergedSettings(t *testing.T) {
	ctx := context.Background()
	metrics, diags := types.ListValueFrom(ctx, types.StringType, []string{"revenue", "orders"})
	if diags.HasError() {
		t.Fatal(diags)
	}
	config := &organizationModel{
		EmbedHosts: types.SetNull(types.StringType),
		FeatureSettings: &organizationFeatureSettingsModel{
			CheckoutLocalizationEnabled: types.BoolValue(true),
			OverviewMetrics:             metrics,
		},
		DisputeSettings: &organizationDisputeSettingsModel{},
	}

	payload := testOrganizationUpdatePayload(t, config)
	features, ok := payload["feature_settings"].(map[string]any)
	if !ok {
		t.Fatalf("feature_settings should be sent, got %v", payload)
	}
	if features["checkout_localization_enabled"] != true {
		t.Errorf("the declared feature should be sent, got %v", features)
	}
	for _, key := range []string{"seat_based_pricing_enabled", "member_model_enabled"} {
		if _, present := features[key]; present {
			t.Errorf("%s is not declared and must be left to the server's merge, got %v", key, features)
		}
	}
	if length := len(features["overview_metrics"].([]any)); length != 2 {
		t.Errorf("the declared overview metrics should be sent, got %v", features)
	}
	// A dispute settings block with nothing in it merges nothing, which is the
	// only honest reading of a declared-but-empty object.
	disputes, ok := payload["dispute_settings"].(map[string]any)
	if !ok || len(disputes) != 0 {
		t.Errorf("an empty dispute settings block should merge nothing, got %v", payload["dispute_settings"])
	}
}

func TestOrganizationUpdateFromConfigClearsAnEmptyEmbedAllowlist(t *testing.T) {
	ctx := context.Background()
	hosts, diags := types.SetValueFrom(ctx, types.StringType, []string{})
	if diags.HasError() {
		t.Fatal(diags)
	}
	payload := testOrganizationUpdatePayload(t, &organizationModel{EmbedHosts: hosts})
	value, present := payload["embed_hosts"]
	if !present {
		t.Fatal("an empty embed_hosts must be sent: it is how the allowlist is cleared")
	}
	if length := len(value.([]any)); length != 0 {
		t.Errorf("embed_hosts should be an empty list, got %v", value)
	}
}

func TestOrganizationToModel(t *testing.T) {
	ctx := context.Background()
	organization := testOrganization()
	model, diags := organizationToModel(ctx, organization, types.StringValue("https://acme.example.com"))
	if diags.HasError() {
		t.Fatal(diags)
	}
	if model.Website.ValueString() != "https://acme.example.com" {
		t.Errorf("an equivalent website should keep the configured spelling, got %v", model.Website)
	}
	if model.CustomerPortalSettings.Subscription.Pause.ValueBool() != true {
		t.Errorf("an optional portal key present server-side should read back, got %v", model.CustomerPortalSettings)
	}
	if model.FeatureSettings == nil || !model.FeatureSettings.SeatBasedPricingEnabled.ValueBool() {
		t.Errorf("self-serve feature settings should read back, got %+v", model.FeatureSettings)
	}
	if model.DisputeSettings.AutoAcceptBelowAmount.ValueInt64() != 500 {
		t.Errorf("dispute settings should read back, got %+v", model.DisputeSettings)
	}
}

// TestOrganizationToModelHandlesAbsentOptionalKeys covers the shapes an
// organization that never touched a setting comes back as: a null
// feature_settings object and portal keys the server simply does not store.
func TestOrganizationToModelHandlesAbsentOptionalKeys(t *testing.T) {
	ctx := context.Background()
	organization := testOrganization()
	organization.FeatureSettings = nil
	organization.CustomerPortalSettings.Subscription.Pause = nil
	organization.CustomerPortalSettings.Customer = nil

	model, diags := organizationToModel(ctx, organization, types.StringNull())
	if diags.HasError() {
		t.Fatal(diags)
	}
	if model.FeatureSettings != nil {
		t.Errorf("an organization without feature settings should read back as a null object, got %+v", model.FeatureSettings)
	}
	if !model.CustomerPortalSettings.Subscription.Pause.IsNull() {
		t.Errorf("an absent portal key should read back as null, got %v", model.CustomerPortalSettings.Subscription.Pause)
	}
	if model.CustomerPortalSettings.Customer != nil {
		t.Errorf("an absent portal sub-object should read back as a null object, got %+v", model.CustomerPortalSettings.Customer)
	}
}

func TestEmbedHostValidator(t *testing.T) {
	valid := []string{"example.com", "*.example.com", "localhost:3000", "192.168.1.43:5500",
		"chrome-extension://abcdef", "xn--caf-dma.com", "localhost:80"}
	for _, value := range valid {
		resp := &validator.StringResponse{}
		embedHost().ValidateString(context.Background(), validator.StringRequest{
			Path:        path.Root("embed_hosts"),
			ConfigValue: types.StringValue(value),
		}, resp)
		if resp.Diagnostics.HasError() {
			t.Errorf("%q should be accepted: %v", value, resp.Diagnostics)
		}
	}
	// Every one of these is stored differently from what was written, which
	// would leave a diff the next plan can never close.
	invalid := []string{" example.com", "example.com ", "Example.COM", "café.com", "example.com:443"}
	for _, value := range invalid {
		resp := &validator.StringResponse{}
		embedHost().ValidateString(context.Background(), validator.StringRequest{
			Path:        path.Root("embed_hosts"),
			ConfigValue: types.StringValue(value),
		}, resp)
		if !resp.Diagnostics.HasError() {
			t.Errorf("%q is rewritten by the API and should be rejected at plan time", value)
		}
	}
}
