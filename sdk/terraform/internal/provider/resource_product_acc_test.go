package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
)

// TestAccProductResource pins down price identity, the product resource's most
// subtle behavior: prices are immutable server-side, so an edit archives the old
// price and creates a new one. Terraform must keep the ID of a price the
// configuration did not touch, and only surrender it when the price genuinely
// changes — otherwise every unrelated `terraform apply` would silently recreate
// the catalog's prices.
func TestAccProductResource(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-product")
	var productID, priceID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckProductArchived(t, &productID),
		Steps: []resource.TestStep{
			{
				Config: testAccProductConfig(name, "A subscription managed by Terraform", 1500),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_product.test", "id"),
					resource.TestCheckResourceAttrSet("polar_product.test", "organization_id"),
					resource.TestCheckResourceAttr("polar_product.test", "name", name),
					resource.TestCheckResourceAttr("polar_product.test", "description", "A subscription managed by Terraform"),
					resource.TestCheckResourceAttr("polar_product.test", "visibility", "public"),
					resource.TestCheckResourceAttr("polar_product.test", "recurring_interval", "month"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.#", "1"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.amount_type", "fixed"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.price_amount", "1500"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.price_currency", "usd"),
					resource.TestCheckResourceAttrSet("polar_product.test", "prices.0.id"),
					captureAttr("polar_product.test", "id", &productID),
					captureAttr("polar_product.test", "prices.0.id", &priceID),
				),
			},
			{
				ResourceName:      "polar_product.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// Renaming leaves the price alone, so its ID must survive.
			{
				Config: testAccProductConfig(name+"-renamed", "A subscription managed by Terraform", 1500),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "name", name+"-renamed"),
					expectAttr("polar_product.test", "id", &productID),
					expectAttr("polar_product.test", "prices.0.id", &priceID),
				),
			},
			// Changing the amount is a new price: the product keeps its ID, the
			// price does not.
			{
				Config: testAccProductConfig(name+"-renamed", "A subscription managed by Terraform", 2500),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.price_amount", "2500"),
					expectAttr("polar_product.test", "id", &productID),
					expectAttrChanged("polar_product.test", "prices.0.id", &priceID),
				),
			},
			// Clearing the description exercises the update's explicit null.
			{
				Config: testAccProductConfigWithoutDescription(name+"-renamed", 2500),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckNoResourceAttr("polar_product.test", "description"),
					expectAttr("polar_product.test", "prices.0.id", &priceID),
				),
			},
		},
	})
}

// TestAccProductResourceMultiPrice covers a product combining a fixed price with
// a metered one backed by a polar_meter resource — the dependency ordering that
// makes archive-on-destroy work in the right sequence, and the price matching
// that has to keep two prices apart.
func TestAccProductResourceMultiPrice(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-product-metered")
	meterName := acctest.RandomWithPrefix("tf-acc-product-meter")
	var productID, fixedPriceID, meteredPriceID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckProductArchived(t, &productID),
		Steps: []resource.TestStep{
			{
				Config: testAccProductMeteredConfig(name, meterName, 2000, "0.015"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "prices.#", "2"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.amount_type", "fixed"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.price_amount", "2000"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.1.amount_type", "metered_unit"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.1.unit_amount", "0.015"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "prices.1.meter_id",
						"polar_meter.test", "id",
					),
					captureAttr("polar_product.test", "id", &productID),
					captureAttr("polar_product.test", "prices.0.id", &fixedPriceID),
					captureAttr("polar_product.test", "prices.1.id", &meteredPriceID),
				),
			},
			{
				ResourceName:      "polar_product.test",
				ImportState:       true,
				ImportStateVerify: true,
				// The API stores unit amounts as decimal(17, 12) and returns
				// them at that scale, so "0.015" comes back as
				// "0.015000000000". An applied resource keeps the spelling from
				// the configuration; an imported one has no configuration to
				// keep, so it holds the API's. The applied state keeps "0.015"
				// and plans clean afterwards — every step here is checked for
				// an empty follow-up plan — so the difference is confined to a
				// freshly imported resource, whose first apply rewrites the
				// spelling without archiving the price (the update compares
				// unit amounts numerically).
				ImportStateVerifyIgnore: []string{"prices.1.unit_amount"},
			},
			// Only the fixed price changes: the metered price must keep its ID
			// while the fixed one is replaced.
			{
				Config: testAccProductMeteredConfig(name, meterName, 3000, "0.015"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.price_amount", "3000"),
					expectAttrChanged("polar_product.test", "prices.0.id", &fixedPriceID),
					expectAttr("polar_product.test", "prices.1.id", &meteredPriceID),
				),
			},
		},
	})
}

// testAccCheckProductArchived asserts the archive-on-destroy semantics: Polar
// has no product deletion, so a destroyed product must come back from the API
// flagged as archived.
func testAccCheckProductArchived(t *testing.T, id *string) resource.TestCheckFunc {
	return destroyCheck(id, func(id string) error {
		product, err := testAccClient(t).GetProduct(testAccContext(t), id)
		if err != nil {
			return fmt.Errorf("reading product %s after destroy: %w", id, err)
		}
		if !product.IsArchived {
			return fmt.Errorf("product %s is not archived after destroy", id)
		}
		return nil
	})
}

func testAccProductConfig(name, description string, amount int) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_product" "test" {
  name               = %[1]q
  description        = %[2]q
  recurring_interval = "month"

  prices = [{
    amount_type  = "fixed"
    price_amount = %[3]d
  }]
}
`, name, description, amount)
}

func testAccProductConfigWithoutDescription(name string, amount int) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_product" "test" {
  name               = %[1]q
  recurring_interval = "month"

  prices = [{
    amount_type  = "fixed"
    price_amount = %[2]d
  }]
}
`, name, amount)
}

func testAccProductMeteredConfig(name, meterName string, amount int, unitAmount string) string {
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

resource "polar_product" "test" {
  name               = %[1]q
  recurring_interval = "month"

  prices = [
    {
      amount_type  = "fixed"
      price_amount = %[3]d
    },
    {
      amount_type = "metered_unit"
      meter_id    = polar_meter.test.id
      unit_amount = %[4]q
    },
  ]
}
`, name, meterName, amount, unitAmount)
}
