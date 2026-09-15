package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
)

func TestAccMeterResource(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-meter")
	var meterID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckMeterArchived(t, &meterID),
		Steps: []resource.TestStep{
			{
				Config: testAccMeterConfig(name, "api_call"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_meter.test", "id"),
					resource.TestCheckResourceAttrSet("polar_meter.test", "organization_id"),
					resource.TestCheckResourceAttrSet("polar_meter.test", "created_at"),
					resource.TestCheckResourceAttr("polar_meter.test", "name", name),
					resource.TestCheckResourceAttr("polar_meter.test", "unit", "scalar"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.conjunction", "and"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.#", "1"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.0.property", "name"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.0.operator", "eq"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.0.value_string", "api_call"),
					resource.TestCheckResourceAttr("polar_meter.test", "aggregation.func", "count"),
					captureAttr("polar_meter.test", "id", &meterID),
				),
			},
			{
				ResourceName:      "polar_meter.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// Renaming touches neither the filter nor the aggregation. The
			// provider must leave both out of the PATCH body: the server 422s on
			// their mere presence once a meter has billed events, so sending them
			// would make renames fail for exactly the meters that matter. This
			// step proves the rename applies and leaves the definition intact;
			// TestMeterUpdateOmitsUnchangedDefinition covers the payload itself.
			{
				Config: testAccMeterConfig(name+"-renamed", "api_call"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_meter.test", "name", name+"-renamed"),
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.0.value_string", "api_call"),
					resource.TestCheckResourceAttr("polar_meter.test", "aggregation.func", "count"),
					expectAttr("polar_meter.test", "id", &meterID),
				),
			},
			// The filter is still mutable while the meter has no billed events.
			{
				Config: testAccMeterConfig(name+"-renamed", "api_call_v2"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_meter.test", "filter.clauses.0.value_string", "api_call_v2"),
					expectAttr("polar_meter.test", "id", &meterID),
				),
			},
		},
	})
}

// TestAccMeterResourceCustomUnit covers the custom-unit branch, whose
// custom_label and custom_multiplier are validated against `unit` at plan time
// and serialized as explicit nulls on update.
func TestAccMeterResourceCustomUnit(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-meter-custom")
	var meterID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckMeterArchived(t, &meterID),
		Steps: []resource.TestStep{
			{
				Config: testAccMeterCustomUnitConfig(name, "request", 1000),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_meter.test", "unit", "custom"),
					resource.TestCheckResourceAttr("polar_meter.test", "custom_label", "request"),
					resource.TestCheckResourceAttr("polar_meter.test", "custom_multiplier", "1000"),
					resource.TestCheckResourceAttr("polar_meter.test", "aggregation.func", "sum"),
					resource.TestCheckResourceAttr("polar_meter.test", "aggregation.property", "tokens"),
					captureAttr("polar_meter.test", "id", &meterID),
				),
			},
			{
				ResourceName:      "polar_meter.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccMeterCustomUnitConfig(name, "requests", 100),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_meter.test", "custom_label", "requests"),
					resource.TestCheckResourceAttr("polar_meter.test", "custom_multiplier", "100"),
					expectAttr("polar_meter.test", "id", &meterID),
				),
			},
		},
	})
}

// testAccCheckMeterArchived asserts the archive-on-destroy semantics: Polar has
// no meter deletion, so a destroyed meter must come back from the API with
// archived_at set rather than disappear.
func testAccCheckMeterArchived(t *testing.T, id *string) resource.TestCheckFunc {
	return destroyCheck(id, func(id string) error {
		meter, err := testAccClient(t).GetMeter(testAccContext(t), id)
		if err != nil {
			return fmt.Errorf("reading meter %s after destroy: %w", id, err)
		}
		if meter.ArchivedAt == nil {
			return fmt.Errorf("meter %s is not archived after destroy", id)
		}
		return nil
	})
}

func testAccMeterConfig(name, event string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_meter" "test" {
  name = %[1]q

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = %[2]q
    }]
  }

  aggregation = {
    func = "count"
  }
}
`, name, event)
}

func testAccMeterCustomUnitConfig(name, label string, multiplier int) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_meter" "test" {
  name              = %[1]q
  unit              = "custom"
  custom_label      = %[2]q
  custom_multiplier = %[3]d

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = "token_usage"
    }]
  }

  aggregation = {
    func     = "sum"
    property = "tokens"
  }
}
`, name, label, multiplier)
}
