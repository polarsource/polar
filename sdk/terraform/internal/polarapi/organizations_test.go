package polarapi

import (
	"encoding/json"
	"testing"
)

// TestOrganizationUpdateSendsOnlyDeclaredKeys guards the payload half of the
// resource's "manage only what you declare" contract: the server applies the
// parsed body with `model_dump(exclude_unset=True)`, so any key present here is
// written to the organization — a stray key would silently overwrite a setting
// managed from the dashboard.
func TestOrganizationUpdateSendsOnlyDeclaredKeys(t *testing.T) {
	name := "Acme"
	encoded, err := json.Marshal(OrganizationUpdate{Name: &name})
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"name":"Acme"}` {
		t.Errorf("an update declaring only the name must send only the name, got %s", encoded)
	}
}

// TestOrganizationUpdateSendsEmptyCollections checks the one way a value can be
// cleared: an empty list is a value, not an omission, so it has to survive
// serialization.
func TestOrganizationUpdateSendsEmptyCollections(t *testing.T) {
	socials := []OrganizationSocial{}
	hosts := []string{}
	metrics := []string{}
	encoded, err := json.Marshal(OrganizationUpdate{
		Socials:         &socials,
		EmbedHosts:      &hosts,
		FeatureSettings: &OrganizationFeatureSettingsUpdate{OverviewMetrics: &metrics},
	})
	if err != nil {
		t.Fatal(err)
	}
	expected := `{"socials":[],"embed_hosts":[],"feature_settings":{"overview_metrics":[]}}`
	if string(encoded) != expected {
		t.Errorf("empty collections must be sent, not omitted:\n got %s\nwant %s", encoded, expected)
	}
}

// TestOrganizationFeatureSettingsUpdateSendsFalse pins that turning a feature
// off is distinguishable from leaving it alone: the server merges this object
// key by key, so a `false` has to reach it while an undeclared key must not.
func TestOrganizationFeatureSettingsUpdateSendsFalse(t *testing.T) {
	off := false
	encoded, err := json.Marshal(OrganizationFeatureSettingsUpdate{CheckoutLocalizationEnabled: &off})
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"checkout_localization_enabled":false}` {
		t.Errorf("a false feature setting must be sent, got %s", encoded)
	}
}

// TestOrganizationSocialOmitsPlatform pins that the provider never sends a
// platform: the server derives it from the URL and overwrites whatever it is
// given, so sending one could only ever contradict the stored value.
func TestOrganizationSocialOmitsPlatform(t *testing.T) {
	encoded, err := json.Marshal(OrganizationSocial{URL: "https://github.com/polarsource"})
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"url":"https://github.com/polarsource"}` {
		t.Errorf("the platform must not be sent, got %s", encoded)
	}
}

// TestOrganizationSubscriptionSettingsAreTotal pins that every key of the
// server's total TypedDict is serialized: a missing one is a 422, not a
// "keep what is stored".
func TestOrganizationSubscriptionSettingsAreTotal(t *testing.T) {
	encoded, err := json.Marshal(OrganizationSubscriptionSettings{ProrationBehavior: "prorate"})
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{
		"allow_multiple_subscriptions", "proration_behavior", "benefit_revocation_grace_period",
		"prevent_trial_abuse", "allow_customer_updates",
	} {
		if _, present := payload[key]; !present {
			t.Errorf("%s must always be sent, got %s", key, encoded)
		}
	}
}

func TestOrganizationUpdateIsEmpty(t *testing.T) {
	if !(OrganizationUpdate{}).IsEmpty() {
		t.Error("an update declaring nothing should be empty: the first PATCH stamps onboarded_at")
	}
	name := "Acme"
	if (OrganizationUpdate{Name: &name}).IsEmpty() {
		t.Error("an update declaring a name is not empty")
	}
	// A settings object declared with nothing inside it still has to be sent:
	// the server merges it, so it is the caller's business, not ours.
	if (OrganizationUpdate{DisputeSettings: &OrganizationDisputeSettingsUpdate{}}).IsEmpty() {
		t.Error("a declared settings object makes the update non-empty")
	}
}
