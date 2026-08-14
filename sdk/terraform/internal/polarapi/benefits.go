package polarapi

import (
	"context"
	"net/http"
)

// Benefit's Properties shape depends on Type; the provider layer maps it to
// the per-type Terraform attributes.
type Benefit struct {
	ID             string         `json:"id"`
	CreatedAt      string         `json:"created_at"`
	Type           string         `json:"type"`
	Description    string         `json:"description"`
	Visibility     string         `json:"visibility"`
	Selectable     bool           `json:"selectable"`
	Deletable      bool           `json:"deletable"`
	OrganizationID string         `json:"organization_id"`
	Properties     map[string]any `json:"properties"`
	Metadata       map[string]any `json:"metadata"`
}

type BenefitCreate struct {
	Type           string         `json:"type"`
	Description    string         `json:"description"`
	OrganizationID *string        `json:"organization_id,omitempty"`
	Visibility     *string        `json:"visibility,omitempty"`
	Properties     map[string]any `json:"properties"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

type BenefitUpdate struct {
	Type        string          `json:"type"`
	Description *string         `json:"description,omitempty"`
	Visibility  *string         `json:"visibility,omitempty"`
	Properties  map[string]any  `json:"properties,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateBenefit(ctx context.Context, create BenefitCreate) (*Benefit, error) {
	var benefit Benefit
	if err := c.do(ctx, http.MethodPost, "/v1/benefits/", create, &benefit); err != nil {
		return nil, err
	}
	return &benefit, nil
}

func (c *Client) GetBenefit(ctx context.Context, id string) (*Benefit, error) {
	var benefit Benefit
	if err := c.do(ctx, http.MethodGet, "/v1/benefits/"+id, nil, &benefit); err != nil {
		return nil, err
	}
	return &benefit, nil
}

func (c *Client) UpdateBenefit(ctx context.Context, id string, update BenefitUpdate) (*Benefit, error) {
	var benefit Benefit
	if err := c.do(ctx, http.MethodPatch, "/v1/benefits/"+id, update, &benefit); err != nil {
		return nil, err
	}
	return &benefit, nil
}

func (c *Client) DeleteBenefit(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/benefits/"+id, nil, nil)
}
