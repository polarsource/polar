package polarapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Filter matches the API's recursive event filter: a conjunction over clauses,
// where each clause is either a leaf comparison or a nested filter.
type Filter struct {
	Conjunction string       `json:"conjunction"`
	Clauses     []FilterNode `json:"clauses"`
}

// FilterNode is one element of Filter.Clauses. Exactly one of Leaf or Nested
// is set.
type FilterNode struct {
	Leaf   *FilterClause
	Nested *Filter
}

// FilterClause is a leaf comparison. Value is a string, an integer, or a
// boolean, mirroring the API's union type.
type FilterClause struct {
	Property string `json:"property"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

func (n FilterNode) MarshalJSON() ([]byte, error) {
	if n.Nested != nil {
		return json.Marshal(n.Nested)
	}
	if n.Leaf != nil {
		return json.Marshal(n.Leaf)
	}
	return nil, fmt.Errorf("filter node has neither a leaf clause nor a nested filter")
}

func (n *FilterNode) UnmarshalJSON(data []byte) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(data, &probe); err != nil {
		return err
	}
	if _, ok := probe["conjunction"]; ok {
		n.Nested = &Filter{}
		return json.Unmarshal(data, n.Nested)
	}
	n.Leaf = &FilterClause{}
	return json.Unmarshal(data, n.Leaf)
}

// Aggregation mirrors the API's aggregation union: count needs no property,
// every other function aggregates over one.
type Aggregation struct {
	Func     string  `json:"func"`
	Property *string `json:"property,omitempty"`
}

type Meter struct {
	ID               string         `json:"id"`
	CreatedAt        string         `json:"created_at"`
	Name             string         `json:"name"`
	Unit             string         `json:"unit"`
	CustomLabel      *string        `json:"custom_label"`
	CustomMultiplier *int64         `json:"custom_multiplier"`
	Filter           Filter         `json:"filter"`
	Aggregation      Aggregation    `json:"aggregation"`
	OrganizationID   string         `json:"organization_id"`
	ArchivedAt       *string        `json:"archived_at"`
	Metadata         map[string]any `json:"metadata"`
}

type MeterCreate struct {
	Name             string         `json:"name"`
	Unit             string         `json:"unit"`
	CustomLabel      *string        `json:"custom_label,omitempty"`
	CustomMultiplier *int64         `json:"custom_multiplier,omitempty"`
	Filter           Filter         `json:"filter"`
	Aggregation      Aggregation    `json:"aggregation"`
	OrganizationID   *string        `json:"organization_id,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
}

// MeterUpdate carries the full desired state of an update. CustomLabel and
// CustomMultiplier serialize explicit nulls (no omitempty) so switching away
// from a custom unit clears them server-side. Filter and Aggregation must only
// be set when they actually change: the server rejects their mere presence
// with a 422 once the meter has billed events. Metadata is a pointer so a
// pointer to an empty map serializes as {} and clears server-side metadata.
type MeterUpdate struct {
	Name             *string         `json:"name,omitempty"`
	Unit             *string         `json:"unit,omitempty"`
	CustomLabel      *string         `json:"custom_label"`
	CustomMultiplier *int64          `json:"custom_multiplier"`
	Filter           *Filter         `json:"filter,omitempty"`
	Aggregation      *Aggregation    `json:"aggregation,omitempty"`
	Metadata         *map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateMeter(ctx context.Context, create MeterCreate) (*Meter, error) {
	var meter Meter
	if err := c.do(ctx, http.MethodPost, "/v1/meters/", create, &meter); err != nil {
		return nil, err
	}
	return &meter, nil
}

func (c *Client) GetMeter(ctx context.Context, id string) (*Meter, error) {
	var meter Meter
	if err := c.do(ctx, http.MethodGet, "/v1/meters/"+id, nil, &meter); err != nil {
		return nil, err
	}
	return &meter, nil
}

func (c *Client) UpdateMeter(ctx context.Context, id string, update MeterUpdate) (*Meter, error) {
	var meter Meter
	if err := c.do(ctx, http.MethodPatch, "/v1/meters/"+id, update, &meter); err != nil {
		return nil, err
	}
	return &meter, nil
}

// ArchiveMeter sends a minimal payload on purpose: a full MeterUpdate would
// carry explicit custom_label/custom_multiplier nulls and wipe those fields as
// a side effect of archiving.
func (c *Client) ArchiveMeter(ctx context.Context, id string) (*Meter, error) {
	var meter Meter
	if err := c.do(ctx, http.MethodPatch, "/v1/meters/"+id, map[string]any{"is_archived": true}, &meter); err != nil {
		return nil, err
	}
	return &meter, nil
}
