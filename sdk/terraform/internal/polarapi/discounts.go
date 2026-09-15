package polarapi

import (
	"context"
	"net/http"
)

type DiscountProduct struct {
	ID string `json:"id"`
}

type Discount struct {
	ID                        string            `json:"id"`
	CreatedAt                 string            `json:"created_at"`
	Name                      string            `json:"name"`
	Type                      string            `json:"type"`
	Duration                  string            `json:"duration"`
	DurationInMonths          *int64            `json:"duration_in_months,omitempty"`
	Code                      *string           `json:"code"`
	StartsAt                  *string           `json:"starts_at"`
	EndsAt                    *string           `json:"ends_at"`
	MaxRedemptions            *int64            `json:"max_redemptions"`
	MaxRedemptionsPerCustomer *int64            `json:"max_redemptions_per_customer"`
	RedemptionsCount          int64             `json:"redemptions_count"`
	Amounts                   map[string]int64  `json:"amounts,omitempty"`
	BasisPoints               *int64            `json:"basis_points,omitempty"`
	OrganizationID            string            `json:"organization_id"`
	Products                  []DiscountProduct `json:"products"`
	Metadata                  map[string]any    `json:"metadata"`
}

type DiscountCreate struct {
	Type                      string           `json:"type"`
	Duration                  string           `json:"duration"`
	DurationInMonths          *int64           `json:"duration_in_months,omitempty"`
	Name                      string           `json:"name"`
	Code                      *string          `json:"code,omitempty"`
	StartsAt                  *string          `json:"starts_at,omitempty"`
	EndsAt                    *string          `json:"ends_at,omitempty"`
	MaxRedemptions            *int64           `json:"max_redemptions,omitempty"`
	MaxRedemptionsPerCustomer *int64           `json:"max_redemptions_per_customer,omitempty"`
	Amounts                   map[string]int64 `json:"amounts,omitempty"`
	BasisPoints               *int64           `json:"basis_points,omitempty"`
	Products                  []string         `json:"products,omitempty"`
	OrganizationID            *string          `json:"organization_id,omitempty"`
	Metadata                  map[string]any   `json:"metadata,omitempty"`
}

// DiscountUpdate carries the full desired state. The clearable optional
// fields (code, the redeemability window, redemption limits) serialize
// explicit nulls so removing them from configuration clears them server-side.
// Products must always be a non-nil slice: the server treats null as "keep"
// and [] as "clear the product restriction". Type, duration and
// duration_in_months are immutable and never sent.
type DiscountUpdate struct {
	Name                      *string          `json:"name,omitempty"`
	Code                      *string          `json:"code"`
	StartsAt                  *string          `json:"starts_at"`
	EndsAt                    *string          `json:"ends_at"`
	MaxRedemptions            *int64           `json:"max_redemptions"`
	MaxRedemptionsPerCustomer *int64           `json:"max_redemptions_per_customer"`
	Amounts                   map[string]int64 `json:"amounts,omitempty"`
	BasisPoints               *int64           `json:"basis_points,omitempty"`
	Products                  []string         `json:"products"`
	Metadata                  *map[string]any  `json:"metadata,omitempty"`
}

func (c *Client) CreateDiscount(ctx context.Context, create DiscountCreate) (*Discount, error) {
	var discount Discount
	if err := c.do(ctx, http.MethodPost, "/v1/discounts/", create, &discount); err != nil {
		return nil, err
	}
	return &discount, nil
}

func (c *Client) GetDiscount(ctx context.Context, id string) (*Discount, error) {
	var discount Discount
	if err := c.do(ctx, http.MethodGet, "/v1/discounts/"+id, nil, &discount); err != nil {
		return nil, err
	}
	return &discount, nil
}

func (c *Client) UpdateDiscount(ctx context.Context, id string, update DiscountUpdate) (*Discount, error) {
	var discount Discount
	if err := c.do(ctx, http.MethodPatch, "/v1/discounts/"+id, update, &discount); err != nil {
		return nil, err
	}
	return &discount, nil
}

func (c *Client) DeleteDiscount(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/discounts/"+id, nil, nil)
}
