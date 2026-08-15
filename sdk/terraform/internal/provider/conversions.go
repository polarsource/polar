package provider

import (
	"context"
	"fmt"
	"math/big"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

var (
	slugRegex         = regexp.MustCompile(`^[a-z0-9-_]+$`)
	httpsURLRegex     = regexp.MustCompile(`^https://`)
	discountCodeRegex = regexp.MustCompile(`^[a-zA-Z0-9]{3,256}$`)
)

// rfc3339Timestamp validates that a string attribute parses as RFC 3339.
type rfc3339TimestampValidator struct{}

func (v rfc3339TimestampValidator) Description(ctx context.Context) string {
	return "must be an RFC 3339 timestamp, e.g. 2026-01-01T00:00:00Z"
}

func (v rfc3339TimestampValidator) MarkdownDescription(ctx context.Context) string {
	return v.Description(ctx)
}

func (v rfc3339TimestampValidator) ValidateString(ctx context.Context, req validator.StringRequest, resp *validator.StringResponse) {
	if req.ConfigValue.IsNull() || req.ConfigValue.IsUnknown() {
		return
	}
	if _, err := time.Parse(time.RFC3339, req.ConfigValue.ValueString()); err != nil {
		resp.Diagnostics.AddAttributeError(
			req.Path,
			"Invalid timestamp",
			"The value must be an RFC 3339 timestamp, e.g. 2026-01-01T00:00:00Z. Parse error: "+err.Error(),
		)
	}
}

func rfc3339Timestamp() validator.String {
	return rfc3339TimestampValidator{}
}

func parseTimestamp(value types.String) *time.Time {
	if value.IsNull() || value.IsUnknown() {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value.ValueString())
	if err != nil {
		return nil
	}
	return &parsed
}

// keepEquivalentTimestamp keeps the configured spelling of a timestamp when
// the API's stored value denotes the same instant (the server normalizes to
// UTC), so the applied value matches the plan.
func keepEquivalentTimestamp(prior types.String, api *string) types.String {
	if api == nil {
		return types.StringNull()
	}
	if prior.IsNull() || prior.IsUnknown() {
		return types.StringValue(*api)
	}
	priorTime, priorErr := time.Parse(time.RFC3339, prior.ValueString())
	apiTime, apiErr := time.Parse(time.RFC3339, *api)
	if priorErr == nil && apiErr == nil && priorTime.Equal(apiTime) {
		return prior
	}
	return types.StringValue(*api)
}

// keepEquivalentDecimal keeps the configured spelling of a decimal amount when
// the API's stored value denotes the same number (the server normalizes the
// scale, so "0.015" comes back as "0.0150"), which keeps the applied value
// matching the plan.
func keepEquivalentDecimal(prior types.String, api *string) types.String {
	if api == nil {
		return types.StringNull()
	}
	if prior.IsNull() || prior.IsUnknown() {
		return types.StringValue(*api)
	}
	if decimalsEqual(prior.ValueString(), *api) {
		return prior
	}
	return types.StringValue(*api)
}

// decimalsEqual compares two decimal strings numerically, so trailing zeros
// and a leading zero before the point don't count as a difference.
func decimalsEqual(a, b string) bool {
	if a == b {
		return true
	}
	parsedA, okA := new(big.Rat).SetString(a)
	parsedB, okB := new(big.Rat).SetString(b)
	return okA && okB && parsedA.Cmp(parsedB) == 0
}

// strippedString rejects values with surrounding whitespace: the API strips
// them, which would leave a permanent diff between configuration and state.
type strippedStringValidator struct{}

func (v strippedStringValidator) Description(ctx context.Context) string {
	return "must not start or end with whitespace"
}

func (v strippedStringValidator) MarkdownDescription(ctx context.Context) string {
	return v.Description(ctx)
}

func (v strippedStringValidator) ValidateString(ctx context.Context, req validator.StringRequest, resp *validator.StringResponse) {
	if req.ConfigValue.IsNull() || req.ConfigValue.IsUnknown() {
		return
	}
	value := req.ConfigValue.ValueString()
	if strings.TrimSpace(value) != value {
		resp.Diagnostics.AddAttributeError(
			req.Path,
			"Surrounding whitespace",
			"The Polar API strips leading and trailing whitespace from this value, which would cause a "+
				"permanent diff. Remove the surrounding whitespace.",
		)
	}
}

func strippedString() validator.String {
	return strippedStringValidator{}
}

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

// priorListIsEmpty reports whether the prior state holds a known, empty list.
// That is the one case where an empty API list should keep the prior value
// rather than reading back as null; a prior list with elements must NOT be
// kept, so out-of-band removal still surfaces as drift. Mirrors
// priorMetadataIsEmptyMap.
func priorListIsEmpty(prior types.List) bool {
	return !prior.IsNull() && !prior.IsUnknown() && len(prior.Elements()) == 0
}

// stringListFromAPI converts an ordered list of API IDs into a list attribute,
// staying null when the API has none so a configuration omitting the attribute
// doesn't drift against an empty list.
func stringListFromAPI(ctx context.Context, ids []string, prior types.List) types.List {
	if len(ids) == 0 {
		if priorListIsEmpty(prior) {
			return prior
		}
		return types.ListNull(types.StringType)
	}
	list, _ := types.ListValueFrom(ctx, types.StringType, ids)
	return list
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
