package provider

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	slugRegex     = regexp.MustCompile(`^[a-z0-9-_]+$`)
	httpsURLRegex = regexp.MustCompile(`^https://`)
)

// noMetadataPrefix rejects property names carrying the "metadata." prefix: the
// API silently strips it, which would leave a permanent diff between the
// configuration and the stored meter.
type noMetadataPrefixValidator struct{}

func (v noMetadataPrefixValidator) Description(ctx context.Context) string {
	return "must not start with \"metadata.\"; use the plain property key"
}

func (v noMetadataPrefixValidator) MarkdownDescription(ctx context.Context) string {
	return v.Description(ctx)
}

func (v noMetadataPrefixValidator) ValidateString(ctx context.Context, req validator.StringRequest, resp *validator.StringResponse) {
	if req.ConfigValue.IsNull() || req.ConfigValue.IsUnknown() {
		return
	}
	if strings.HasPrefix(req.ConfigValue.ValueString(), "metadata.") {
		resp.Diagnostics.AddAttributeError(
			req.Path,
			"Redundant metadata prefix",
			"The Polar API strips the \"metadata.\" prefix from property names, which would cause a "+
				"permanent diff. Use the plain property key instead.",
		)
	}
}

func noMetadataPrefix() validator.String {
	return noMetadataPrefixValidator{}
}

// configureClient extracts the API client stored by the provider's Configure
// method. It returns nil (without a diagnostic) when the provider is not yet
// configured, which the framework contract allows.
func configureClient(providerData any, diags *diag.Diagnostics) *polarapi.Client {
	if providerData == nil {
		return nil
	}
	client, ok := providerData.(*polarapi.Client)
	if !ok {
		diags.AddError(
			"Unexpected provider data",
			fmt.Sprintf("Expected *polarapi.Client, got %T. This is a bug in the provider.", providerData),
		)
		return nil
	}
	return client
}

// metadataToAPI converts the resource's metadata attribute (a map of strings)
// into the API's metadata object.
func metadataToAPI(ctx context.Context, metadata types.Map) (map[string]any, diag.Diagnostics) {
	var diags diag.Diagnostics
	if metadata.IsNull() || metadata.IsUnknown() {
		return nil, diags
	}
	elements := map[string]string{}
	diags.Append(metadata.ElementsAs(ctx, &elements, false)...)
	if diags.HasError() {
		return nil, diags
	}
	result := make(map[string]any, len(elements))
	for key, value := range elements {
		result[key] = value
	}
	return result, diags
}

// metadataFromAPI converts the API's metadata object (values are strings,
// numbers, or booleans) back into the resource's map-of-strings attribute.
// The map stays null when the API has no metadata, so a config that omits
// metadata doesn't drift against an empty object.
func metadataFromAPI(ctx context.Context, metadata map[string]any) types.Map {
	if len(metadata) == 0 {
		return types.MapNull(types.StringType)
	}
	converted := make(map[string]string, len(metadata))
	for key, value := range metadata {
		converted[key] = metadataValueToString(value)
	}
	mapValue, _ := types.MapValueFrom(ctx, types.StringType, converted)
	return mapValue
}

func metadataValueToString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case bool:
		return strconv.FormatBool(typed)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}

// priorMetadataIsEmptyMap reports whether the prior state holds a known,
// empty metadata map. That is the one case where a null read-back should keep
// the prior value (config `metadata = {}` and the API's absent metadata are
// the same thing); a prior map with keys must NOT be kept, so out-of-band
// metadata deletion still surfaces as drift.
func priorMetadataIsEmptyMap(prior types.Map) bool {
	return !prior.IsNull() && !prior.IsUnknown() && len(prior.Elements()) == 0
}

// urlsEquivalent compares two URLs the way pydantic normalizes them
// server-side: case-insensitive scheme and host, default HTTPS port stripped,
// and an empty path equal to "/". This lets the provider keep the user's
// spelling in state while the API stores the normalized form.
func urlsEquivalent(a, b string) bool {
	if a == b {
		return true
	}
	parsedA, errA := url.Parse(a)
	parsedB, errB := url.Parse(b)
	if errA != nil || errB != nil {
		return false
	}
	normalizeHost := func(u *url.URL) string {
		return strings.TrimSuffix(strings.ToLower(u.Host), ":443")
	}
	normalizePath := func(u *url.URL) string {
		if u.EscapedPath() == "" {
			return "/"
		}
		return u.EscapedPath()
	}
	return strings.EqualFold(parsedA.Scheme, parsedB.Scheme) &&
		normalizeHost(parsedA) == normalizeHost(parsedB) &&
		normalizePath(parsedA) == normalizePath(parsedB) &&
		parsedA.RawQuery == parsedB.RawQuery &&
		parsedA.Fragment == parsedB.Fragment
}

func stringPointer(value types.String) *string {
	if value.IsNull() || value.IsUnknown() {
		return nil
	}
	result := value.ValueString()
	return &result
}

func int64Pointer(value types.Int64) *int64 {
	if value.IsNull() || value.IsUnknown() {
		return nil
	}
	result := value.ValueInt64()
	return &result
}

func boolPointer(value types.Bool) *bool {
	if value.IsNull() || value.IsUnknown() {
		return nil
	}
	result := value.ValueBool()
	return &result
}

func stringFromPointer(value *string) types.String {
	if value == nil {
		return types.StringNull()
	}
	return types.StringValue(*value)
}

func int64FromPointer(value *int64) types.Int64 {
	if value == nil {
		return types.Int64Null()
	}
	return types.Int64Value(*value)
}
