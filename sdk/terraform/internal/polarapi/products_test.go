package polarapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProductPriceUpdateMarshalsUnion(t *testing.T) {
	id := "00000000-0000-0000-0000-000000000001"
	amount := int64(0)
	unitAmount := "0.0150"

	encoded, err := json.Marshal([]ProductPriceUpdate{
		{ExistingID: &id},
		{Create: &ProductPriceCreate{AmountType: "fixed", PriceCurrency: "usd", PriceAmount: &amount}},
		{Create: &ProductPriceCreate{
			AmountType:    "metered_unit",
			PriceCurrency: "usd",
			MeterID:       &id,
			UnitAmount:    &unitAmount,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}

	expected := `[` +
		`{"id":"00000000-0000-0000-0000-000000000001"},` +
		`{"amount_type":"fixed","price_currency":"usd","price_amount":0},` +
		`{"amount_type":"metered_unit","price_currency":"usd",` +
		`"meter_id":"00000000-0000-0000-0000-000000000001","unit_amount":"0.0150"}` +
		`]`
	if string(encoded) != expected {
		t.Errorf("price update union marshalled as\n%s\nwant\n%s", encoded, expected)
	}
}

func TestProductPriceUpdateRequiresOneVariant(t *testing.T) {
	if _, err := json.Marshal(ProductPriceUpdate{}); err == nil {
		t.Fatal("an empty price update must not marshal: it would read as an invalid price payload")
	}
}

func TestProductPriceUnitAmountKeepsScale(t *testing.T) {
	// The API serializes decimals as JSON strings, but json.Number also
	// tolerates a bare number, and neither must round-trip through a float64.
	for _, raw := range []string{`{"unit_amount": "0.012345678901"}`, `{"unit_amount": 0.012345678901}`} {
		var price ProductPrice
		if err := json.Unmarshal([]byte(raw), &price); err != nil {
			t.Fatal(err)
		}
		if price.UnitAmount == nil || price.UnitAmount.String() != "0.012345678901" {
			t.Errorf("decoding %s lost the decimal scale: %v", raw, price.UnitAmount)
		}
	}
}

func TestProductUpdateSerializesClearingNulls(t *testing.T) {
	// The server applies the payload with model_dump(exclude_unset=True): keys
	// present with a null value clear the field, absent keys leave it alone.
	name := "Pro"
	encoded, err := json.Marshal(ProductUpdate{
		Name:                 &name,
		Prices:               []ProductPriceUpdate{},
		Medias:               []string{},
		AttachedCustomFields: []ProductAttachedCustomField{},
	})
	if err != nil {
		t.Fatal(err)
	}
	body := string(encoded)
	for _, key := range []string{`"description":null`, `"trial_interval":null`, `"trial_interval_count":null`} {
		if !strings.Contains(body, key) {
			t.Errorf("clearable field must serialize an explicit null, %s missing from %s", key, body)
		}
	}
	for _, key := range []string{`"medias":[]`, `"attached_custom_fields":[]`, `"prices":[]`} {
		if !strings.Contains(body, key) {
			t.Errorf("replaceable list must serialize as [] and never null, %s missing from %s", key, body)
		}
	}
	if strings.Contains(body, `"recurring_interval"`) || strings.Contains(body, `"is_archived"`) {
		t.Errorf("the update must never carry recurring_interval or is_archived, got %s", body)
	}
}

func TestArchiveProductSendsMinimalPayload(t *testing.T) {
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %q, want PATCH", r.Method)
		}
		if got := r.URL.Path; got != "/v1/products/prod-1" {
			t.Errorf("path = %q", got)
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "prod-1", "is_archived": true})
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	product, err := client.ArchiveProduct(t.Context(), "prod-1")
	if err != nil {
		t.Fatal(err)
	}
	if !product.IsArchived {
		t.Error("archiving should return the archived product")
	}
	if len(body) != 1 || body["is_archived"] != true {
		t.Errorf("archiving must send only is_archived, got %v", body)
	}
}

func TestUpdateProductBenefitsSendsOrderedList(t *testing.T) {
	var body struct {
		Benefits []string `json:"benefits"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Path; got != "/v1/products/prod-1/benefits" {
			t.Errorf("path = %q", got)
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "prod-1"})
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	if _, err := client.UpdateProductBenefits(t.Context(), "prod-1", nil); err != nil {
		t.Fatal(err)
	}
	if body.Benefits == nil || len(body.Benefits) != 0 {
		t.Errorf("a nil benefit list must clear the attachments with [], got %v", body.Benefits)
	}
}
