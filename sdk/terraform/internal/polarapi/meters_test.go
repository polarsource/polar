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

func jsonEqual(a, b any) bool {
	aBytes, errA := json.Marshal(a)
	bBytes, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(aBytes) == string(bBytes)
}
