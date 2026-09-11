package polarapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ProductPriceSourceCatalog marks the prices declared on the product itself.
// Prices created dynamically by a Checkout session are `ad_hoc` and are never
// part of the declared catalog.
const ProductPriceSourceCatalog = "catalog"

type ProductPriceSeatTier struct {
	MinSeats     int64  `json:"min_seats"`
	MaxSeats     *int64 `json:"max_seats"`
	PricePerSeat int64  `json:"price_per_seat"`
}

// ProductPriceSeatTiers carries the seat pricing ladder. The API's read schema
// adds computed minimum_seats/maximum_seats fields, which are derived from the
// tiers and deliberately not decoded.
type ProductPriceSeatTiers struct {
	SeatTierType string                 `json:"seat_tier_type"`
	Tiers        []ProductPriceSeatTier `json:"tiers"`
}

// ProductPriceCreate is the superset of the API's per-amount_type price
// creation payloads. Only the fields belonging to the discriminating
// amount_type may be set; the provider enforces that at plan time.
//
// UnitAmount is a string on purpose: the API stores it as a 12-decimal-place
// decimal, and routing it through a JSON number would round-trip through a
// float64 somewhere along the way.
type ProductPriceCreate struct {
	AmountType    string                 `json:"amount_type"`
	PriceCurrency string                 `json:"price_currency"`
	TaxBehavior   *string                `json:"tax_behavior,omitempty"`
	PriceAmount   *int64                 `json:"price_amount,omitempty"`
	MinimumAmount *int64                 `json:"minimum_amount,omitempty"`
	MaximumAmount *int64                 `json:"maximum_amount,omitempty"`
	PresetAmount  *int64                 `json:"preset_amount,omitempty"`
	SeatTiers     *ProductPriceSeatTiers `json:"seat_tiers,omitempty"`
	MeterID       *string                `json:"meter_id,omitempty"`
	UnitAmount    *string                `json:"unit_amount,omitempty"`
	CapAmount     *int64                 `json:"cap_amount,omitempty"`
}

// ProductPriceUpdate is one element of ProductUpdate.Prices. The API's element
// type is a union: `{"id": ...}` keeps an existing price, anything else creates
// a new one. Exactly one of ExistingID or Create is set.
type ProductPriceUpdate struct {
	ExistingID *string
	Create     *ProductPriceCreate
}

func (p ProductPriceUpdate) MarshalJSON() ([]byte, error) {
	if p.ExistingID != nil {
		return json.Marshal(map[string]string{"id": *p.ExistingID})
	}
	if p.Create != nil {
		return json.Marshal(p.Create)
	}
	return nil, fmt.Errorf("product price update has neither an existing price ID nor a create payload")
}

// ProductPrice is the API's read shape for a price. UnitAmount decodes as a
// json.Number so the server's exact decimal spelling survives: the API
// serializes it as a JSON string, but json.Number also accepts a bare number.
// Legacy is only present on the deprecated per-price recurring variants.
type ProductPrice struct {
	ID            string                 `json:"id"`
	CreatedAt     string                 `json:"created_at"`
	Source        string                 `json:"source"`
	AmountType    string                 `json:"amount_type"`
	PriceCurrency string                 `json:"price_currency"`
	TaxBehavior   *string                `json:"tax_behavior"`
	IsArchived    bool                   `json:"is_archived"`
	ProductID     string                 `json:"product_id"`
	Legacy        bool                   `json:"legacy"`
	PriceAmount   *int64                 `json:"price_amount"`
	MinimumAmount *int64                 `json:"minimum_amount"`
	MaximumAmount *int64                 `json:"maximum_amount"`
	PresetAmount  *int64                 `json:"preset_amount"`
	SeatTiers     *ProductPriceSeatTiers `json:"seat_tiers"`
	MeterID       *string                `json:"meter_id"`
	UnitAmount    *json.Number           `json:"unit_amount"`
	CapAmount     *int64                 `json:"cap_amount"`
}

type ProductBenefit struct {
	ID string `json:"id"`
}

type ProductMedia struct {
	ID string `json:"id"`
}

// ProductAttachedCustomField serves both directions: the read schema adds a
// nested custom_field object and an order, both of which are redundant with
// the attachment list's position and are not decoded.
type ProductAttachedCustomField struct {
	CustomFieldID string `json:"custom_field_id"`
	Required      bool   `json:"required"`
}

type Product struct {
	ID                     string                       `json:"id"`
	CreatedAt              string                       `json:"created_at"`
	Name                   string                       `json:"name"`
	Description            *string                      `json:"description"`
	Visibility             string                       `json:"visibility"`
	RecurringInterval      *string                      `json:"recurring_interval"`
	RecurringIntervalCount *int64                       `json:"recurring_interval_count"`
	MeterInterval          *string                      `json:"meter_interval"`
	MeterIntervalCount     *int64                       `json:"meter_interval_count"`
	TrialInterval          *string                      `json:"trial_interval"`
	TrialIntervalCount     *int64                       `json:"trial_interval_count"`
	IsRecurring            bool                         `json:"is_recurring"`
	IsArchived             bool                         `json:"is_archived"`
	OrganizationID         string                       `json:"organization_id"`
	Prices                 []ProductPrice               `json:"prices"`
	Benefits               []ProductBenefit             `json:"benefits"`
	Medias                 []ProductMedia               `json:"medias"`
	AttachedCustomFields   []ProductAttachedCustomField `json:"attached_custom_fields"`
	Metadata               map[string]any               `json:"metadata"`
}

// ProductCreate mirrors the API's discriminated create schema: omitting
// recurring_interval selects the one-time variant, which rejects the recurring
// and trial fields outright.
type ProductCreate struct {
	Name                   string                       `json:"name"`
	Description            *string                      `json:"description,omitempty"`
	Visibility             string                       `json:"visibility"`
	RecurringInterval      *string                      `json:"recurring_interval,omitempty"`
	RecurringIntervalCount *int64                       `json:"recurring_interval_count,omitempty"`
	MeterInterval          *string                      `json:"meter_interval,omitempty"`
	MeterIntervalCount     *int64                       `json:"meter_interval_count,omitempty"`
	TrialInterval          *string                      `json:"trial_interval,omitempty"`
	TrialIntervalCount     *int64                       `json:"trial_interval_count,omitempty"`
	Prices                 []ProductPriceCreate         `json:"prices"`
	Medias                 []string                     `json:"medias,omitempty"`
	AttachedCustomFields   []ProductAttachedCustomField `json:"attached_custom_fields,omitempty"`
	OrganizationID         *string                      `json:"organization_id,omitempty"`
	Metadata               map[string]any               `json:"metadata,omitempty"`
}

// ProductUpdate carries the full desired state. The server applies the parsed
// payload with `model_dump(exclude_unset=True)`, so every key present here is
// written to the product — including explicit nulls. That makes Description
// and the trial fields clearable by sending null, and makes it unsafe to ever
// send a null Name, Visibility or Metadata (hence omitempty on those).
//
// recurring_interval, meter_interval and is_archived are deliberately absent:
// the first two are immutable (the resource forces replacement instead) and a
// null recurring_interval would silently convert a subscription product into a
// one-time one. Archiving goes through ArchiveProduct.
//
// Prices, Medias and AttachedCustomFields must always be non-nil slices: the
// server treats null as "keep" and a list as "replace with exactly this".
type ProductUpdate struct {
	Name                 *string                      `json:"name,omitempty"`
	Description          *string                      `json:"description"`
	Visibility           *string                      `json:"visibility,omitempty"`
	TrialInterval        *string                      `json:"trial_interval"`
	TrialIntervalCount   *int64                       `json:"trial_interval_count"`
	Prices               []ProductPriceUpdate         `json:"prices"`
	Medias               []string                     `json:"medias"`
	AttachedCustomFields []ProductAttachedCustomField `json:"attached_custom_fields"`
	Metadata             *map[string]any              `json:"metadata,omitempty"`
}

func (c *Client) CreateProduct(ctx context.Context, create ProductCreate) (*Product, error) {
	var product Product
	if err := c.do(ctx, http.MethodPost, "/v1/products/", create, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

func (c *Client) GetProduct(ctx context.Context, id string) (*Product, error) {
	var product Product
	if err := c.do(ctx, http.MethodGet, "/v1/products/"+id, nil, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

func (c *Client) UpdateProduct(ctx context.Context, id string, update ProductUpdate) (*Product, error) {
	var product Product
	if err := c.do(ctx, http.MethodPatch, "/v1/products/"+id, update, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

// UpdateProductBenefits replaces the product's benefit attachments with the
// given ordered list. Benefits live behind their own endpoint because the
// server re-runs benefit grant processing for every call.
func (c *Client) UpdateProductBenefits(ctx context.Context, id string, benefits []string) (*Product, error) {
	if benefits == nil {
		benefits = []string{}
	}
	var product Product
	payload := map[string]any{"benefits": benefits}
	if err := c.do(ctx, http.MethodPost, "/v1/products/"+id+"/benefits", payload, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

// ArchiveProduct sends a minimal payload on purpose: a full ProductUpdate
// would carry an explicit description null and empty price, media and custom
// field lists, wiping those as a side effect of archiving.
func (c *Client) ArchiveProduct(ctx context.Context, id string) (*Product, error) {
	var product Product
	if err := c.do(ctx, http.MethodPatch, "/v1/products/"+id, map[string]any{"is_archived": true}, &product); err != nil {
		return nil, err
	}
	return &product, nil
}
