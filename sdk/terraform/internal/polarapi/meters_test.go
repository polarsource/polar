package polarapi

import (
	"encoding/json"
	"testing"
)

func TestFilterRoundTrip(t *testing.T) {
	// The dashboard-produced shape: an outer conjunction mixing a leaf clause
	// and a nested group of clauses.
	raw := `{
		"conjunction": "and",
		"clauses": [
			{"property": "name", "operator": "eq", "value": "api_call"},
			{
				"conjunction": "or",
				"clauses": [
					{"property": "region", "operator": "eq", "value": "eu"},
					{"property": "tokens", "operator": "gt", "value": 100},
					{"property": "cached", "operator": "eq", "value": false}
				]
			}
		]
	}`

	var filter Filter
	if err := json.Unmarshal([]byte(raw), &filter); err != nil {
		t.Fatal(err)
	}

	if filter.Conjunction != "and" || len(filter.Clauses) != 2 {
		t.Fatalf("unexpected top-level shape: %+v", filter)
	}
	if filter.Clauses[0].Leaf == nil || filter.Clauses[0].Leaf.Property != "name" {
		t.Errorf("first clause should be the name leaf, got %+v", filter.Clauses[0])
	}
	nested := filter.Clauses[1].Nested
	if nested == nil || nested.Conjunction != "or" || len(nested.Clauses) != 3 {
		t.Fatalf("second clause should be a 3-clause nested group, got %+v", filter.Clauses[1])
	}
	if nested.Clauses[1].Leaf.Value != float64(100) {
		t.Errorf("numeric value should decode as a number, got %T %v", nested.Clauses[1].Leaf.Value, nested.Clauses[1].Leaf.Value)
	}

	encoded, err := json.Marshal(filter)
	if err != nil {
		t.Fatal(err)
	}
	var reparsed, original any
	if err := json.Unmarshal(encoded, &reparsed); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(raw), &original); err != nil {
		t.Fatal(err)
	}
	if !jsonEqual(reparsed, original) {
		t.Errorf("round trip changed the filter:\noriginal: %v\nreparsed: %v", original, reparsed)
	}
}

// TestMeterUpdateOmitsUnchangedDefinition guards the payload half of the
// meter's rename path: once a meter has billed events the server 422s on the
// mere presence of filter or aggregation, so an update that does not change
// them must leave the keys out entirely. The acceptance test can only observe
// that a rename succeeds; this observes what is sent.
func TestMeterUpdateOmitsUnchangedDefinition(t *testing.T) {
	name := "Renamed"
	metadata := map[string]any{}
	encoded, err := json.Marshal(MeterUpdate{Name: &name, Metadata: &metadata})
	if err != nil {
		t.Fatal(err)
	}

	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"filter", "aggregation"} {
		if _, present := payload[key]; present {
			t.Errorf("%s must be omitted when unchanged, got %s", key, encoded)
		}
	}
	// custom_label and custom_multiplier carry explicit nulls so switching away
	// from a custom unit clears them.
	for _, key := range []string{"custom_label", "custom_multiplier"} {
		value, present := payload[key]
		if !present || value != nil {
			t.Errorf("%s must serialize as an explicit null, got %s", key, encoded)
		}
	}
}

func jsonEqual(a, b any) bool {
	aBytes, errA := json.Marshal(a)
	bBytes, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(aBytes) == string(bBytes)
}
