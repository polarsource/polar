package polarapi

import (
	"context"
	"net/http"
)

type WebhookEndpoint struct {
	ID             string   `json:"id"`
	CreatedAt      string   `json:"created_at"`
	URL            string   `json:"url"`
	Name           *string  `json:"name"`
	Format         string   `json:"format"`
	Secret         string   `json:"secret"`
	OrganizationID string   `json:"organization_id"`
	Events         []string `json:"events"`
	Enabled        bool     `json:"enabled"`
}

type WebhookEndpointCreate struct {
	URL            string   `json:"url"`
	Name           *string  `json:"name,omitempty"`
	Format         string   `json:"format"`
	Events         []string `json:"events"`
	OrganizationID *string  `json:"organization_id,omitempty"`
}

type WebhookEndpointUpdate struct {
	URL     *string  `json:"url,omitempty"`
	Name    *string  `json:"name,omitempty"`
	Format  *string  `json:"format,omitempty"`
	Events  []string `json:"events,omitempty"`
	Enabled *bool    `json:"enabled,omitempty"`
}

func (c *Client) CreateWebhookEndpoint(ctx context.Context, create WebhookEndpointCreate) (*WebhookEndpoint, error) {
	var endpoint WebhookEndpoint
	if err := c.do(ctx, http.MethodPost, "/v1/webhooks/endpoints", create, &endpoint); err != nil {
		return nil, err
	}
	return &endpoint, nil
}

func (c *Client) GetWebhookEndpoint(ctx context.Context, id string) (*WebhookEndpoint, error) {
	var endpoint WebhookEndpoint
	if err := c.do(ctx, http.MethodGet, "/v1/webhooks/endpoints/"+id, nil, &endpoint); err != nil {
		return nil, err
	}
	return &endpoint, nil
}

func (c *Client) UpdateWebhookEndpoint(ctx context.Context, id string, update WebhookEndpointUpdate) (*WebhookEndpoint, error) {
	var endpoint WebhookEndpoint
	if err := c.do(ctx, http.MethodPatch, "/v1/webhooks/endpoints/"+id, update, &endpoint); err != nil {
		return nil, err
	}
	return &endpoint, nil
}

func (c *Client) DeleteWebhookEndpoint(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/webhooks/endpoints/"+id, nil, nil)
}
