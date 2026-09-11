package polarapi

import (
	"context"
	"net/http"
)

type CustomFieldSelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// CustomFieldProperties is the superset of the per-type properties objects.
// The API validates which keys are allowed for each custom field type; the
// provider enforces the same rules at plan time.
type CustomFieldProperties struct {
	FormLabel       *string                   `json:"form_label,omitempty"`
	FormHelpText    *string                   `json:"form_help_text,omitempty"`
	FormPlaceholder *string                   `json:"form_placeholder,omitempty"`
	Textarea        *bool                     `json:"textarea,omitempty"`
	MinLength       *int64                    `json:"min_length,omitempty"`
	MaxLength       *int64                    `json:"max_length,omitempty"`
	Ge              *int64                    `json:"ge,omitempty"`
	Le              *int64                    `json:"le,omitempty"`
	Options         []CustomFieldSelectOption `json:"options,omitempty"`
}

type CustomField struct {
	ID             string                `json:"id"`
	CreatedAt      string                `json:"created_at"`
	Type           string                `json:"type"`
	Slug           string                `json:"slug"`
	Name           string                `json:"name"`
	OrganizationID string                `json:"organization_id"`
	Properties     CustomFieldProperties `json:"properties"`
	Metadata       map[string]any        `json:"metadata"`
}

type CustomFieldCreate struct {
	Type           string                `json:"type"`
	Slug           string                `json:"slug"`
	Name           string                `json:"name"`
	OrganizationID *string               `json:"organization_id,omitempty"`
	Properties     CustomFieldProperties `json:"properties"`
	Metadata       map[string]any        `json:"metadata,omitempty"`
}

type CustomFieldUpdate struct {
	Type       string                 `json:"type"`
	Slug       *string                `json:"slug,omitempty"`
	Name       *string                `json:"name,omitempty"`
	Properties *CustomFieldProperties `json:"properties,omitempty"`
	// Metadata is a pointer so a pointer to an empty map serializes as
	// {"metadata": {}} and clears server-side metadata; a plain map with
	// omitempty would drop the key and the server would keep the old value.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

func (c *Client) CreateCustomField(ctx context.Context, create CustomFieldCreate) (*CustomField, error) {
	var customField CustomField
	if err := c.do(ctx, http.MethodPost, "/v1/custom-fields/", create, &customField); err != nil {
		return nil, err
	}
	return &customField, nil
}

func (c *Client) GetCustomField(ctx context.Context, id string) (*CustomField, error) {
	var customField CustomField
	if err := c.do(ctx, http.MethodGet, "/v1/custom-fields/"+id, nil, &customField); err != nil {
		return nil, err
	}
	return &customField, nil
}

func (c *Client) UpdateCustomField(ctx context.Context, id string, update CustomFieldUpdate) (*CustomField, error) {
	var customField CustomField
	if err := c.do(ctx, http.MethodPatch, "/v1/custom-fields/"+id, update, &customField); err != nil {
		return nil, err
	}
	return &customField, nil
}

func (c *Client) DeleteCustomField(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/custom-fields/"+id, nil, nil)
}
