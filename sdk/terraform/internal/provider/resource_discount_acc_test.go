package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/hashicorp/terraform-plugin-testing/terraform"
)

func TestAccDiscountResourcePercentage(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-discount")
	// Discount codes are alphanumeric only, so they cannot reuse the
	// hyphenated random name.
	code := "tfacc" + acctest.RandString(10)
	var discountID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckDiscountDestroyed(t, &discountID),
		Steps: []resource.TestStep{
			{
				Config: testAccDiscountPercentageConfig(name, 2550, fmt.Sprintf("code = %q", code)),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_discount.test", "id"),
					resource.TestCheckResourceAttrSet("polar_discount.test", "organization_id"),
					resource.TestCheckResourceAttr("polar_discount.test", "name", name),
					resource.TestCheckResourceAttr("polar_discount.test", "type", "percentage"),
					resource.TestCheckResourceAttr("polar_discount.test", "duration", "once"),
					resource.TestCheckResourceAttr("polar_discount.test", "basis_points", "2550"),
					resource.TestCheckResourceAttr("polar_discount.test", "code", code),
					resource.TestCheckResourceAttr("polar_discount.test", "redemptions_count", "0"),
					resource.TestCheckNoResourceAttr("polar_discount.test", "amounts"),
					captureAttr("polar_discount.test", "id", &discountID),
				),
			},
			{
				ResourceName:      "polar_discount.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccDiscountPercentageConfig(name+"-updated", 1000, fmt.Sprintf("code = %q", code)),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_discount.test", "name", name+"-updated"),
					resource.TestCheckResourceAttr("polar_discount.test", "basis_points", "1000"),
					expectAttr("polar_discount.test", "id", &discountID),
				),
			},
			// Removing an optional attribute has to reach the API: the update
			// sends an explicit null, so the code is really cleared rather than
			// left behind and re-read on the next plan.
			{
				Config: testAccDiscountPercentageConfig(name+"-updated", 1000, ""),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckNoResourceAttr("polar_discount.test", "code"),
					testAccCheckDiscountCodeCleared(t, &discountID),
					expectAttr("polar_discount.test", "id", &discountID),
				),
			},
		},
	})
}

func TestAccDiscountResourceFixed(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-discount-fixed")
	var discountID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckDiscountDestroyed(t, &discountID),
		Steps: []resource.TestStep{
			{
				Config: testAccDiscountFixedConfig(name, 1000),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_discount.test", "type", "fixed"),
					resource.TestCheckResourceAttr("polar_discount.test", "duration", "repeating"),
					resource.TestCheckResourceAttr("polar_discount.test", "duration_in_months", "3"),
					resource.TestCheckResourceAttr("polar_discount.test", "amounts.usd", "1000"),
					resource.TestCheckNoResourceAttr("polar_discount.test", "basis_points"),
					captureAttr("polar_discount.test", "id", &discountID),
				),
			},
			{
				ResourceName:      "polar_discount.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccDiscountFixedConfig(name, 2000),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_discount.test", "amounts.usd", "2000"),
					expectAttr("polar_discount.test", "id", &discountID),
				),
			},
		},
	})
}

func testAccCheckDiscountDestroyed(t *testing.T, id *string) resource.TestCheckFunc {
	return expectDeleted(t, "discount", id, testAccClient(t).GetDiscount)
}

// testAccCheckDiscountCodeCleared confirms the clearing happened server-side,
// not just in Terraform's state.
func testAccCheckDiscountCodeCleared(t *testing.T, id *string) resource.TestCheckFunc {
	return func(*terraform.State) error {
		discount, err := testAccClient(t).GetDiscount(testAccContext(t), *id)
		if err != nil {
			return fmt.Errorf("reading discount %s: %w", *id, err)
		}
		if discount.Code != nil {
			return fmt.Errorf("discount %s still has code %q server-side", *id, *discount.Code)
		}
		return nil
	}
}

func testAccDiscountPercentageConfig(name string, basisPoints int, codeAttribute string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_discount" "test" {
  name         = %[1]q
  type         = "percentage"
  duration     = "once"
  basis_points = %[2]d
  %[3]s
}
`, name, basisPoints, codeAttribute)
}

func testAccDiscountFixedConfig(name string, amount int) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_discount" "test" {
  name               = %[1]q
  type               = "fixed"
  duration           = "repeating"
  duration_in_months = 3

  amounts = {
    usd = %[2]d
  }
}
`, name, amount)
}
