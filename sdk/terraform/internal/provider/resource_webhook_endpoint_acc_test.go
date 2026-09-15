package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/hashicorp/terraform-plugin-testing/statecheck"
	"github.com/hashicorp/terraform-plugin-testing/terraform"
	"github.com/hashicorp/terraform-plugin-testing/tfjsonpath"
)

func TestAccWebhookEndpointResource(t *testing.T) {
	path := acctest.RandomWithPrefix("tf-acc")
	url := "https://example.com/polar/" + path
	var endpointID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckWebhookEndpointDestroyed(t, &endpointID),
		Steps: []resource.TestStep{
			{
				Config: testAccWebhookEndpointConfig(url, "Terraform "+path, `["order.created"]`, true),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_webhook_endpoint.test", "id"),
					resource.TestCheckResourceAttrSet("polar_webhook_endpoint.test", "organization_id"),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "url", url),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "format", "raw"),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "enabled", "true"),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "events.#", "1"),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "events.0", "order.created"),
					// Polar generates the signing secret; it must land in state
					// so `terraform output` can feed it to the receiving app.
					resource.TestCheckResourceAttrSet("polar_webhook_endpoint.test", "secret"),
					captureAttr("polar_webhook_endpoint.test", "id", &endpointID),
				),
				ConfigStateChecks: []statecheck.StateCheck{
					statecheck.ExpectSensitiveValue("polar_webhook_endpoint.test", tfjsonpath.New("secret")),
				},
			},
			{
				ResourceName:      "polar_webhook_endpoint.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccWebhookEndpointConfig(
					url, "Terraform "+path,
					`["order.created", "subscription.created", "subscription.revoked"]`, true,
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "events.#", "3"),
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "events.2", "subscription.revoked"),
					expectAttr("polar_webhook_endpoint.test", "id", &endpointID),
				),
			},
		},
	})
}

// TestAccWebhookEndpointResourceDisabled covers the create path that has to
// follow up with an update: the API always creates endpoints enabled, so
// `enabled = false` is only honored by a second call.
func TestAccWebhookEndpointResourceDisabled(t *testing.T) {
	path := acctest.RandomWithPrefix("tf-acc-disabled")
	url := "https://example.com/polar/" + path
	var endpointID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckWebhookEndpointDestroyed(t, &endpointID),
		Steps: []resource.TestStep{
			{
				Config: testAccWebhookEndpointConfig(url, "Terraform "+path, `["order.created"]`, false),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "enabled", "false"),
					testAccCheckWebhookEndpointDisabled(t, &endpointID),
					captureAttr("polar_webhook_endpoint.test", "id", &endpointID),
				),
			},
			{
				Config: testAccWebhookEndpointConfig(url, "Terraform "+path, `["order.created"]`, true),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_webhook_endpoint.test", "enabled", "true"),
					expectAttr("polar_webhook_endpoint.test", "id", &endpointID),
				),
			},
		},
	})
}

func testAccCheckWebhookEndpointDestroyed(t *testing.T, id *string) resource.TestCheckFunc {
	return expectDeleted(t, "webhook endpoint", id, testAccClient(t).GetWebhookEndpoint)
}

// testAccCheckWebhookEndpointDisabled confirms the follow-up update reached the
// API rather than only the Terraform state.
func testAccCheckWebhookEndpointDisabled(t *testing.T, id *string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		value, err := stateAttribute(state, "polar_webhook_endpoint.test", "id")
		if err != nil {
			return err
		}
		endpoint, err := testAccClient(t).GetWebhookEndpoint(testAccContext(t), value)
		if err != nil {
			return fmt.Errorf("reading webhook endpoint %s: %w", value, err)
		}
		if endpoint.Enabled {
			return fmt.Errorf("webhook endpoint %s is enabled server-side", value)
		}
		return nil
	}
}

func testAccWebhookEndpointConfig(url, name, events string, enabled bool) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_webhook_endpoint" "test" {
  url     = %[1]q
  name    = %[2]q
  format  = "raw"
  events  = %[3]s
  enabled = %[4]t
}
`, url, name, events, enabled)
}
