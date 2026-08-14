// Package provider implements the Polar Terraform provider on top of the
// terraform-plugin-framework, using the thin internal API client in
// internal/polarapi.
package provider

import (
	"context"
	"os"

	"github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var _ provider.Provider = (*polarProvider)(nil)

type polarProvider struct {
	version string
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &polarProvider{version: version}
	}
}

type polarProviderModel struct {
	AccessToken types.String `tfsdk:"access_token"`
	Server      types.String `tfsdk:"server"`
	BaseURL     types.String `tfsdk:"base_url"`
}

func (p *polarProvider) Metadata(ctx context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "polar"
	resp.Version = p.version
}

func (p *polarProvider) Schema(ctx context.Context, req provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Manage a Polar organization's product catalog and settings. " +
			"Authenticates with an organization access token created in the Polar dashboard.",
		Attributes: map[string]schema.Attribute{
			"access_token": schema.StringAttribute{
				MarkdownDescription: "Organization access token (`polar_oat_...`). " +
					"Can also be set with the `POLAR_ACCESS_TOKEN` environment variable.",
				Optional:  true,
				Sensitive: true,
			},
			"server": schema.StringAttribute{
				MarkdownDescription: "Polar environment to target: `production` (default) or `sandbox`. " +
					"Can also be set with the `POLAR_SERVER` environment variable. " +
					"Tokens are environment-specific: a production token does not work against sandbox.",
				Optional: true,
				Validators: []validator.String{
					stringvalidator.OneOf("production", "sandbox"),
				},
			},
			"base_url": schema.StringAttribute{
				MarkdownDescription: "Override the API base URL, e.g. to target a local development stack. " +
					"Takes precedence over `server`. " +
					"Can also be set with the `POLAR_BASE_URL` environment variable.",
				Optional: true,
			},
		},
	}
}

func (p *polarProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config polarProviderModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	unknownAttributes := map[string]types.String{
		"access_token": config.AccessToken,
		"server":       config.Server,
		"base_url":     config.BaseURL,
	}
	for name, value := range unknownAttributes {
		if value.IsUnknown() {
			resp.Diagnostics.AddAttributeError(
				path.Root(name),
				"Unknown provider configuration value",
				"The provider cannot be configured with a value that is only known after apply. "+
					"Set "+name+" to a static value or an environment variable.",
			)
		}
	}
	if resp.Diagnostics.HasError() {
		return
	}

	token := os.Getenv("POLAR_ACCESS_TOKEN")
	if !config.AccessToken.IsNull() {
		token = config.AccessToken.ValueString()
	}
	if token == "" {
		resp.Diagnostics.AddAttributeError(
			path.Root("access_token"),
			"Missing Polar access token",
			"Set the access_token provider attribute or the POLAR_ACCESS_TOKEN environment variable. "+
				"Create an organization access token in the Polar dashboard under Settings.",
		)
		return
	}

	server := os.Getenv("POLAR_SERVER")
	if !config.Server.IsNull() {
		server = config.Server.ValueString()
	}
	baseURL := polarapi.ServerProduction
	switch server {
	case "", "production":
	case "sandbox":
		baseURL = polarapi.ServerSandbox
	default:
		resp.Diagnostics.AddAttributeError(
			path.Root("server"),
			"Invalid Polar server",
			"The server must be either \"production\" or \"sandbox\", got: "+server,
		)
		return
	}
	if override := os.Getenv("POLAR_BASE_URL"); override != "" {
		baseURL = override
	}
	if !config.BaseURL.IsNull() {
		baseURL = config.BaseURL.ValueString()
	}

	client := polarapi.New(baseURL, token, "terraform-provider-polar/"+p.version)
	resp.ResourceData = client
	resp.DataSourceData = client
}

func (p *polarProvider) Resources(ctx context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		NewCustomFieldResource,
		NewWebhookEndpointResource,
		NewMeterResource,
	}
}

func (p *polarProvider) DataSources(ctx context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{}
}
