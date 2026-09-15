package provider

// Acceptance tests run real create/read/update/destroy cycles against a live
// Polar environment, driven by the terraform CLI. They only run when TF_ACC is
// set (`make testacc`); `go test ./...` skips them.
//
// They all share one organization — the one the access token belongs to — so
// they never call t.Parallel: a suite racing on the same catalog trips the
// server's uniqueness rules (one price per meter per currency, one custom field
// per slug) for reasons that have nothing to do with the provider. Every
// resource is named with a random suffix so a rerun after an interrupted
// destroy doesn't collide with leftovers either.
//
// Against a local development stack, `make testacc-local` mints the token and
// runs them. Against a dedicated sandbox organization:
//
//	POLAR_ACCESS_TOKEN=polar_oat_... POLAR_SERVER=sandbox make testacc

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/providerserver"
	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/hashicorp/terraform-plugin-testing/terraform"

	"github.com/polarsource/terraform-provider-polar/internal/polarapi"
)

// providerConfig prefixes every acceptance configuration. The provider reads
// its credentials from the environment, so the block stays empty; declaring it
// explicitly keeps the configurations self-contained.
const providerConfig = `
provider "polar" {}
`

var testAccProtoV6ProviderFactories = map[string]func() (tfprotov6.ProviderServer, error){
	"polar": providerserver.NewProtocol6WithError(New("acceptance")()),
}

// testAccPreCheck fails the test — rather than letting it fail deep inside an
// apply — when the environment cannot reach a Polar API.
func testAccPreCheck(t *testing.T) {
	t.Helper()
	if os.Getenv("POLAR_ACCESS_TOKEN") == "" {
		t.Fatal("POLAR_ACCESS_TOKEN must be set for acceptance tests. " +
			"Mint one for a local stack with sdk/terraform/tools/mint_acceptance_token.py.")
	}
	if os.Getenv("POLAR_BASE_URL") == "" && os.Getenv("POLAR_SERVER") == "" {
		t.Fatal("POLAR_BASE_URL or POLAR_SERVER must be set for acceptance tests. " +
			"Acceptance tests create and destroy real resources, so they refuse to " +
			"default to production.")
	}
}

// testAccClient builds an API client with the same configuration the provider
// resolves, for the checks that have to look at the API directly: verifying
// archive-on-destroy, or that a deleted resource is really gone.
func testAccClient(t *testing.T) *polarapi.Client {
	t.Helper()
	baseURL := polarapi.ServerProduction
	if os.Getenv("POLAR_SERVER") == "sandbox" {
		baseURL = polarapi.ServerSandbox
	}
	if override := os.Getenv("POLAR_BASE_URL"); override != "" {
		baseURL = override
	}
	return polarapi.New(baseURL, os.Getenv("POLAR_ACCESS_TOKEN"), "terraform-provider-polar/acceptance")
}

// testAccContext bounds the out-of-band API calls the checks make, so a hung
// request fails its check instead of running out the suite's timeout.
func testAccContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	return ctx
}

// destroyCheck runs a CheckDestroy body against the ID a step captured. An
// empty ID means the resource was never created, and the step that captures it
// has already failed on its own, so there is nothing left to verify — reporting
// it again would only bury the real failure.
func destroyCheck(id *string, verify func(id string) error) resource.TestCheckFunc {
	return func(*terraform.State) error {
		if *id == "" {
			return nil
		}
		return verify(*id)
	}
}

// expectDeleted builds the CheckDestroy for a resource Polar really deletes,
// as opposed to the meters and products it archives.
func expectDeleted[T any](
	t *testing.T, kind string, id *string, get func(context.Context, string) (*T, error),
) resource.TestCheckFunc {
	return destroyCheck(id, func(id string) error {
		_, err := get(testAccContext(t), id)
		if err == nil {
			return fmt.Errorf("%s %s still exists after destroy", kind, id)
		}
		if !polarapi.IsNotFound(err) {
			return fmt.Errorf("reading %s %s after destroy: %w", kind, id, err)
		}
		return nil
	})
}

func stateAttribute(state *terraform.State, name, key string) (string, error) {
	resourceState, ok := state.RootModule().Resources[name]
	if !ok {
		return "", fmt.Errorf("resource %s is not in state", name)
	}
	value, ok := resourceState.Primary.Attributes[key]
	if !ok {
		return "", fmt.Errorf("resource %s has no attribute %s", name, key)
	}
	return value, nil
}

// captureAttr records an attribute value so a later step — or CheckDestroy,
// which runs once the state is gone — can assert against it.
func captureAttr(name, key string, target *string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		value, err := stateAttribute(state, name, key)
		if err != nil {
			return err
		}
		*target = value
		return nil
	}
}

// expectAttr asserts an attribute still holds a previously captured value: the
// resource was updated in place rather than replaced.
func expectAttr(name, key string, expected *string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		value, err := stateAttribute(state, name, key)
		if err != nil {
			return err
		}
		if value != *expected {
			return fmt.Errorf("%s.%s = %q, expected it to still be %q", name, key, value, *expected)
		}
		return nil
	}
}

// expectAttrChanged asserts an attribute no longer holds a previously captured
// value, and records the new one so it can be compared again later.
func expectAttrChanged(name, key string, previous *string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		value, err := stateAttribute(state, name, key)
		if err != nil {
			return err
		}
		if value == *previous {
			return fmt.Errorf("%s.%s = %q, expected it to have changed", name, key, value)
		}
		*previous = value
		return nil
	}
}
