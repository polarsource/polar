package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
)

func TestAccBenefitResource(t *testing.T) {
	// Benefit descriptions are capped at 42 characters, so the randomness has
	// to be short enough to leave room for the " updated" suffix.
	description := "tf-acc " + acctest.RandString(8)
	var benefitID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckBenefitDestroyed(t, &benefitID),
		Steps: []resource.TestStep{
			{
				Config: testAccBenefitCustomConfig(description, "Thanks for subscribing"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_benefit.test", "id"),
					resource.TestCheckResourceAttrSet("polar_benefit.test", "organization_id"),
					resource.TestCheckResourceAttr("polar_benefit.test", "type", "custom"),
					resource.TestCheckResourceAttr("polar_benefit.test", "description", description),
					resource.TestCheckResourceAttr("polar_benefit.test", "custom.note", "Thanks for subscribing"),
					resource.TestCheckResourceAttr("polar_benefit.test", "selectable", "true"),
					resource.TestCheckResourceAttr("polar_benefit.test", "deletable", "true"),
					captureAttr("polar_benefit.test", "id", &benefitID),
				),
			},
			{
				ResourceName:      "polar_benefit.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccBenefitCustomConfig(description+" updated", "Thanks again"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_benefit.test", "description", description+" updated"),
					resource.TestCheckResourceAttr("polar_benefit.test", "custom.note", "Thanks again"),
					expectAttr("polar_benefit.test", "id", &benefitID),
				),
			},
		},
	})
}

// TestAccBenefitResourceMeterCredit covers the meter_credit type, whose
// properties reference another Terraform-managed resource and whose grants are
// re-run on every update.
func TestAccBenefitResourceMeterCredit(t *testing.T) {
	description := "tf-acc credit " + acctest.RandString(8)
	meterName := acctest.RandomWithPrefix("tf-acc-benefit-meter")
	var benefitID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckBenefitDestroyed(t, &benefitID),
		Steps: []resource.TestStep{
			{
				Config: testAccBenefitMeterCreditConfig(description, meterName, 1000, false),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_benefit.test", "type", "meter_credit"),
					resource.TestCheckResourceAttr("polar_benefit.test", "meter_credit.units", "1000"),
					resource.TestCheckResourceAttr("polar_benefit.test", "meter_credit.rollover", "false"),
					resource.TestCheckResourceAttrPair(
						"polar_benefit.test", "meter_credit.meter_id",
						"polar_meter.test", "id",
					),
					captureAttr("polar_benefit.test", "id", &benefitID),
				),
			},
			{
				ResourceName:      "polar_benefit.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccBenefitMeterCreditConfig(description+" v2", meterName, 2500, true),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_benefit.test", "description", description+" v2"),
					resource.TestCheckResourceAttr("polar_benefit.test", "meter_credit.units", "2500"),
					resource.TestCheckResourceAttr("polar_benefit.test", "meter_credit.rollover", "true"),
					expectAttr("polar_benefit.test", "id", &benefitID),
				),
			},
		},
	})
}

// testAccCheckBenefitDestroyed asserts benefits are really deleted — unlike
// meters and products, they have a DELETE endpoint.
func testAccCheckBenefitDestroyed(t *testing.T, id *string) resource.TestCheckFunc {
	return expectDeleted(t, "benefit", id, testAccClient(t).GetBenefit)
}

func testAccBenefitCustomConfig(description, note string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_benefit" "test" {
  type        = "custom"
  description = %[1]q

  custom = {
    note = %[2]q
  }
}
`, description, note)
}

func testAccBenefitMeterCreditConfig(description, meterName string, units int, rollover bool) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_meter" "test" {
  name = %[2]q

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = "api_call"
    }]
  }

  aggregation = {
    func = "count"
  }
}

resource "polar_benefit" "test" {
  type        = "meter_credit"
  description = %[1]q

  meter_credit = {
    units    = %[3]d
    rollover = %[4]t
    meter_id = polar_meter.test.id
  }
}
`, description, meterName, units, rollover)
}
