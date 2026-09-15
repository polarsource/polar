package provider

import (
	"fmt"
	"os"
	"regexp"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/hashicorp/terraform-plugin-testing/terraform"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

// The organization is the one thing the whole suite shares — every other test
// creates its resources inside it — so these tests only touch settings nothing
// else reads: the name, the website, the embed allowlist, the subscription
// settings and one customer email toggle. The values are deliberately not random beyond the
// name's suffix, so a rerun after an interrupted destroy converges instead of
// accumulating, and t.Cleanup puts the organization back the way it was found.
const (
	testAccOrganizationWebsite = "https://tf-acc.example.com/"
	testAccOrganizationHost    = "tf-acc.example.com"
)

// testAccOrganizationFixture reads the organization the token belongs to and
// registers the cleanup that restores it. It skips the same way resource.Test
// would, since it runs before the test case does.
func testAccOrganizationFixture(t *testing.T) *polarapi.Organization {
	t.Helper()
	if os.Getenv("TF_ACC") == "" {
		t.Skip("Acceptance tests skipped unless TF_ACC is set")
	}
	testAccPreCheck(t)

	client := testAccClient(t)
	organizations, total, err := client.ListOrganizations(testAccContext(t), 2)
	if err != nil {
		t.Fatalf("reading the token's organization: %v", err)
	}
	if total != 1 || len(organizations) != 1 {
		t.Fatalf("expected the token to belong to exactly one organization, got %d", total)
	}
	original := organizations[0]

	t.Cleanup(func() {
		hosts := original.EmbedHosts
		if hosts == nil {
			hosts = []string{}
		}
		restore := polarapi.OrganizationUpdate{
			Name:                  &original.Name,
			EmbedHosts:            &hosts,
			SubscriptionSettings:  &original.SubscriptionSettings,
			CustomerEmailSettings: &original.CustomerEmailSettings,
		}
		if original.FeatureSettings != nil {
			// Only the feature the test toggles is restored; the rest are
			// staff-managed or one-way switches.
			restore.FeatureSettings = &polarapi.OrganizationFeatureSettingsUpdate{
				CheckoutLocalizationEnabled: &original.FeatureSettings.CheckoutLocalizationEnabled,
			}
		}
		// The website can only be restored when there was one: an omitted key
		// keeps the stored value and the provider never sends an explicit null.
		// The test's website is a constant, so what is left behind is stable.
		if original.Website != nil {
			restore.Website = original.Website
		}
		if _, err := client.UpdateOrganization(testAccContext(t), original.ID, restore); err != nil {
			t.Errorf("restoring the organization after the test: %v", err)
		}
	})

	return &original
}

func TestAccOrganizationResource(t *testing.T) {
	original := testAccOrganizationFixture(t)
	name := original.Name + " " + acctest.RandomWithPrefix("tf-acc")
	var organizationID string

	// The two settings the test flips have to end up somewhere they were not,
	// or "the other keys survived" proves nothing.
	renewalReminder := !original.CustomerEmailSettings.SubscriptionRenewalReminder
	localization := true
	if original.FeatureSettings != nil {
		localization = !original.FeatureSettings.CheckoutLocalizationEnabled
	}

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		// Destroy must leave the organization exactly as the last step left it:
		// the resource is forgotten, not deleted.
		CheckDestroy: testAccCheckOrganizationSurvivesDestroy(t, &organizationID, original.Name),
		Steps: []resource.TestStep{
			// Creating the resource adopts the token's organization rather than
			// creating one, and applies only what the configuration declares.
			{
				Config: testAccOrganizationConfig(fmt.Sprintf("name = %q", name)),
				Check: resource.ComposeAggregateTestCheckFunc(
					testAccCheckOrganizationAdopted(t, "polar_organization.test"),
					resource.TestCheckResourceAttr("polar_organization.test", "id", original.ID),
					resource.TestCheckResourceAttr("polar_organization.test", "slug", original.Slug),
					resource.TestCheckResourceAttr("polar_organization.test", "name", name),
					resource.TestCheckResourceAttrSet("polar_organization.test", "created_at"),
					// Undeclared settings are read back, so the resource is a
					// full picture of the organization without managing it.
					resource.TestCheckResourceAttrSet("polar_organization.test", "customer_email_settings.order_confirmation"),
					resource.TestCheckResourceAttrSet("polar_organization.test", "default_presentment_currency"),
					captureAttr("polar_organization.test", "id", &organizationID),
				),
			},
			{
				ResourceName:      "polar_organization.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// Declaring more settings updates them in place, and leaves every
			// setting the configuration still does not mention alone.
			{
				Config: testAccOrganizationConfig(fmt.Sprintf(`
  name    = %q
  website = %q

  embed_hosts = [%q, "*.%s"]

  subscription_settings = {
    benefit_revocation_grace_period = 7
  }

  customer_email_settings = {
    subscription_renewal_reminder = %t
  }

  feature_settings = {
    checkout_localization_enabled = %t
  }
`, name+" v2", testAccOrganizationWebsite, testAccOrganizationHost, testAccOrganizationHost,
					renewalReminder, localization)),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_organization.test", "name", name+" v2"),
					resource.TestCheckResourceAttr("polar_organization.test", "website", testAccOrganizationWebsite),
					resource.TestCheckResourceAttr("polar_organization.test", "embed_hosts.#", "2"),
					resource.TestCheckResourceAttr("polar_organization.test", "subscription_settings.benefit_revocation_grace_period", "7"),
					// The two subscription settings the step does not declare
					// keep the organization's values instead of being reset,
					// even though the API replaces the object wholesale.
					resource.TestCheckResourceAttr("polar_organization.test", "subscription_settings.proration_behavior",
						original.SubscriptionSettings.ProrationBehavior),
					// One email toggle is declared; the other thirteen have to
					// survive an API call that replaces the whole object.
					resource.TestCheckResourceAttr("polar_organization.test",
						"customer_email_settings.subscription_renewal_reminder", fmt.Sprintf("%t", renewalReminder)),
					resource.TestCheckResourceAttr("polar_organization.test",
						"customer_email_settings.order_confirmation",
						fmt.Sprintf("%t", original.CustomerEmailSettings.OrderConfirmation)),
					resource.TestCheckResourceAttr("polar_organization.test",
						"feature_settings.checkout_localization_enabled", fmt.Sprintf("%t", localization)),
					testAccCheckOrganizationUndeclaredSettingsUntouched(t, &organizationID, original),
					// The organization is updated in place; there is nothing to
					// replace it with.
					expectAttr("polar_organization.test", "id", &organizationID),
				),
			},
			// A shorter allowlist replaces the stored one rather than merging
			// into it, and the settings this step stops declaring are left
			// where the previous step put them.
			{
				Config: testAccOrganizationConfig(fmt.Sprintf(`
  name = %q

  embed_hosts = [%q]
`, name+" v2", testAccOrganizationHost)),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_organization.test", "embed_hosts.#", "1"),
					resource.TestCheckResourceAttr("polar_organization.test", "embed_hosts.0", testAccOrganizationHost),
					// The website and the subscription grace period are no
					// longer declared: they stay on the organization and stay
					// in state, because an attribute that is not declared is
					// not managed.
					resource.TestCheckResourceAttr("polar_organization.test", "website", testAccOrganizationWebsite),
					resource.TestCheckResourceAttr("polar_organization.test",
						"subscription_settings.benefit_revocation_grace_period", "7"),
					expectAttr("polar_organization.test", "id", &organizationID),
				),
			},
			// Put the shared organization back before the destroy, so what
			// CheckDestroy finds is a sane organization rather than a test one.
			{
				Config: testAccOrganizationConfig(fmt.Sprintf(`
  name        = %q
  embed_hosts = []

  subscription_settings = {
    benefit_revocation_grace_period = %d
  }

  customer_email_settings = {
    subscription_renewal_reminder = %t
  }

  feature_settings = {
    checkout_localization_enabled = %t
  }
`, original.Name, original.SubscriptionSettings.BenefitRevocationGracePeriod,
					original.CustomerEmailSettings.SubscriptionRenewalReminder, !localization)),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_organization.test", "name", original.Name),
					resource.TestCheckResourceAttr("polar_organization.test", "embed_hosts.#", "0"),
					resource.TestCheckResourceAttr("polar_organization.test",
						"customer_email_settings.subscription_renewal_reminder",
						fmt.Sprintf("%t", original.CustomerEmailSettings.SubscriptionRenewalReminder)),
				),
			},
		},
	})
}

// TestAccOrganizationResourceAdoptOnly covers the degenerate configuration the
// singleton makes possible: a resource that declares no setting at all adopts
// the organization, reads it, and sends nothing.
func TestAccOrganizationResourceAdoptOnly(t *testing.T) {
	original := testAccOrganizationFixture(t)

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: testAccOrganizationConfig(""),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_organization.test", "id", original.ID),
					resource.TestCheckResourceAttr("polar_organization.test", "name", original.Name),
					resource.TestCheckResourceAttr("polar_organization.test", "slug", original.Slug),
					resource.TestCheckResourceAttrSet("polar_organization.test", "status"),
				),
			},
		},
	})
}

// TestAccOrganizationResourceSeatBasedLatch covers the one setting the API
// refuses to take back: seat-based pricing cannot be disabled once enabled, and
// the provider cannot know that at plan time, so the apply has to fail with an
// explanation and leave the organization alone.
func TestAccOrganizationResourceSeatBasedLatch(t *testing.T) {
	original := testAccOrganizationFixture(t)
	if original.FeatureSettings == nil || !original.FeatureSettings.SeatBasedPricingEnabled {
		t.Skip("the organization does not have seat-based pricing enabled, so there is no latch to trip")
	}

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: testAccOrganizationConfig(`
  feature_settings = {
    seat_based_pricing_enabled = false
  }
`),
				ExpectError: regexp.MustCompile("Seat-based pricing is a one-way switch"),
			},
		},
	})

	organization, err := testAccClient(t).GetOrganization(testAccContext(t), original.ID)
	if err != nil {
		t.Fatalf("reading the organization after the rejected apply: %v", err)
	}
	if organization.FeatureSettings == nil || !organization.FeatureSettings.SeatBasedPricingEnabled {
		t.Error("a rejected apply must leave the organization exactly as it was")
	}
}

// testAccCheckOrganizationAdopted asserts the resource picked up the
// organization the access token belongs to rather than inventing an ID.
func testAccCheckOrganizationAdopted(t *testing.T, name string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		id, err := stateAttribute(state, name, "id")
		if err != nil {
			return err
		}
		organizations, _, err := testAccClient(t).ListOrganizations(testAccContext(t), 2)
		if err != nil {
			return fmt.Errorf("listing the token's organizations: %w", err)
		}
		if len(organizations) != 1 {
			return fmt.Errorf("expected the token to belong to exactly one organization, got %d", len(organizations))
		}
		if organizations[0].ID != id {
			return fmt.Errorf("%s adopted organization %s, but the token belongs to %s",
				name, id, organizations[0].ID)
		}
		return nil
	}
}

// testAccCheckOrganizationUndeclaredSettingsUntouched asserts server-side what
// the state cannot: the settings objects the API replaces wholesale still carry
// the values the configuration never mentioned.
func testAccCheckOrganizationUndeclaredSettingsUntouched(
	t *testing.T, id *string, original *polarapi.Organization,
) resource.TestCheckFunc {
	return func(*terraform.State) error {
		organization, err := testAccClient(t).GetOrganization(testAccContext(t), *id)
		if err != nil {
			return fmt.Errorf("reading organization %s: %w", *id, err)
		}
		// Every email toggle but the one the step declares must be untouched,
		// even though the API replaces the whole object.
		emails := organization.CustomerEmailSettings
		emails.SubscriptionRenewalReminder = original.CustomerEmailSettings.SubscriptionRenewalReminder
		if emails != original.CustomerEmailSettings {
			return fmt.Errorf("customer email settings changed without being declared: %+v, expected %+v",
				organization.CustomerEmailSettings, original.CustomerEmailSettings)
		}
		if organization.SubscriptionSettings.PreventTrialAbuse != original.SubscriptionSettings.PreventTrialAbuse ||
			organization.SubscriptionSettings.AllowCustomerUpdates != original.SubscriptionSettings.AllowCustomerUpdates {
			return fmt.Errorf("subscription settings this resource does not expose were rewritten: %+v, expected %+v",
				organization.SubscriptionSettings, original.SubscriptionSettings)
		}
		if organization.DefaultPresentmentCurrency != original.DefaultPresentmentCurrency {
			return fmt.Errorf("the default presentment currency changed without being declared: %s",
				organization.DefaultPresentmentCurrency)
		}
		// The staff-managed and one-way feature settings survive a partial
		// feature_settings write, which the server merges key by key.
		if original.FeatureSettings != nil && organization.FeatureSettings != nil {
			if organization.FeatureSettings.SeatBasedPricingEnabled != original.FeatureSettings.SeatBasedPricingEnabled ||
				organization.FeatureSettings.MemberModelEnabled != original.FeatureSettings.MemberModelEnabled {
				return fmt.Errorf("feature settings changed without being declared: %+v",
					organization.FeatureSettings)
			}
		}
		return nil
	}
}

// testAccCheckOrganizationSurvivesDestroy is the inverse of the other
// resources' CheckDestroy: destroying a polar_organization forgets it, so the
// organization must still be there afterwards, with the settings the last step
// applied.
func testAccCheckOrganizationSurvivesDestroy(t *testing.T, id *string, name string) resource.TestCheckFunc {
	return destroyCheck(id, func(id string) error {
		organization, err := testAccClient(t).GetOrganization(testAccContext(t), id)
		if err != nil {
			return fmt.Errorf("organization %s should survive destroy, but reading it failed: %w", id, err)
		}
		if organization.Name != name {
			return fmt.Errorf("destroy should change nothing, but the organization is now named %q, expected %q",
				organization.Name, name)
		}
		return nil
	})
}

func testAccOrganizationConfig(body string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_organization" "test" {
%s
}
`, body)
}
