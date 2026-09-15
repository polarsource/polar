package provider

import (
	"fmt"
	"slices"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/hashicorp/terraform-plugin-testing/terraform"
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

// TestAccProductResourceSeatBased covers seat-based pricing, whose price is a
// whole tier ladder rather than an amount: the tiers have to survive the round
// trip in the order they were written (the API sorts them, and a reordering
// would show up as a perpetual diff), the tier type has to default to `volume`
// server-side and client-side alike, and a tier's rate is part of the price —
// changing one replaces the price like any other price edit.
//
// The organization needs `seat_based_pricing_enabled`, which
// tools/mint_acceptance_token.py ensures.
func TestAccProductResourceSeatBased(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-product-seats")
	var productID, priceID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckProductArchived(t, &productID),
		Steps: []resource.TestStep{
			{
				Config: testAccProductSeatBasedConfig(name, 1500),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "prices.#", "1"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.amount_type", "seat_based"),
					// Never set in the configuration: this is the schema default
					// meeting the server's, which is the same value.
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.seat_tier_type", "volume"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.#", "3"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.0.min_seats", "1"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.0.max_seats", "5"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.0.price_per_seat", "2000"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.1.min_seats", "6"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.1.max_seats", "20"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.1.price_per_seat", "1500"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.2.min_seats", "21"),
					// The unbounded tier: the API returns a null max_seats, which
					// has to stay null rather than collapse to zero.
					resource.TestCheckNoResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.2.max_seats"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.2.price_per_seat", "1000"),
					captureAttr("polar_product.test", "id", &productID),
					captureAttr("polar_product.test", "prices.0.id", &priceID),
				),
			},
			{
				ResourceName:      "polar_product.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// Repricing the middle tier is a price change: the product keeps its
			// ID, the price does not.
			{
				Config: testAccProductSeatBasedConfig(name, 1200),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.1.price_per_seat", "1200"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.0.price_per_seat", "2000"),
					resource.TestCheckResourceAttr("polar_product.test", "prices.0.seat_tiers.tiers.2.price_per_seat", "1000"),
					expectAttr("polar_product.test", "id", &productID),
					expectAttrChanged("polar_product.test", "prices.0.id", &priceID),
				),
			},
		},
	})
}

// TestAccProductResourceBenefits covers the benefit attachments, which the
// provider applies through a separate endpoint and deliberately only calls when
// the list changes. Every assertion is made against the API as well as the
// state: a product update that dropped the attachments would leave Terraform's
// state right and the catalog wrong.
func TestAccProductResourceBenefits(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-product-benefits")
	first := "tf-acc first " + acctest.RandString(8)
	second := "tf-acc second " + acctest.RandString(8)
	var productID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckProductArchived(t, &productID),
		Steps: []resource.TestStep{
			{
				Config: testAccProductBenefitsConfig(
					name, "Sold with one benefit", first, second, "[polar_benefit.first.id]",
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "benefits.#", "1"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "benefits.0",
						"polar_benefit.first", "id",
					),
					testAccCheckProductBenefits(t, "polar_benefit.first"),
					captureAttr("polar_product.test", "id", &productID),
				),
			},
			{
				ResourceName:      "polar_product.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// Attaching the second benefit and putting it first: the list is
			// ordered, so this is a reorder as much as an addition.
			{
				Config: testAccProductBenefitsConfig(
					name, "Sold with two benefits", first, second,
					"[polar_benefit.second.id, polar_benefit.first.id]",
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "benefits.#", "2"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "benefits.0",
						"polar_benefit.second", "id",
					),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "benefits.1",
						"polar_benefit.first", "id",
					),
					testAccCheckProductBenefits(t, "polar_benefit.second", "polar_benefit.first"),
					expectAttr("polar_product.test", "id", &productID),
				),
			},
			// An edit that leaves the benefits alone skips the benefits endpoint
			// entirely. The product update it does send must not clear them.
			{
				Config: testAccProductBenefitsConfig(
					name, "Sold with two benefits, described again", first, second,
					"[polar_benefit.second.id, polar_benefit.first.id]",
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "description", "Sold with two benefits, described again"),
					resource.TestCheckResourceAttr("polar_product.test", "benefits.#", "2"),
					testAccCheckProductBenefits(t, "polar_benefit.second", "polar_benefit.first"),
					expectAttr("polar_product.test", "id", &productID),
				),
			},
			// Detaching one leaves the benefit itself alive — only the
			// attachment goes away.
			{
				Config: testAccProductBenefitsConfig(
					name, "Sold with two benefits, described again", first, second,
					"[polar_benefit.second.id]",
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "benefits.#", "1"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "benefits.0",
						"polar_benefit.second", "id",
					),
					testAccCheckProductBenefits(t, "polar_benefit.second"),
					resource.TestCheckResourceAttrSet("polar_benefit.first", "id"),
					expectAttr("polar_product.test", "id", &productID),
				),
			},
			// Dropping the attribute detaches everything. The schema asks for an
			// omitted attribute rather than an empty list, so the product must
			// come back with a null list and not drift against `[]`.
			{
				Config: testAccProductBenefitsConfig(
					name, "Sold on its own", first, second, "null",
				),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckNoResourceAttr("polar_product.test", "benefits.#"),
					testAccCheckProductBenefits(t),
					expectAttr("polar_product.test", "id", &productID),
				),
			},
		},
	})
}

// TestAccProductResourceCustomFields covers the checkout fields attached to a
// product. Unlike benefits they ride along with the product update, so what
// matters is that the attachment round-trips and that its `required` flag can
// be flipped without detaching the field.
func TestAccProductResourceCustomFields(t *testing.T) {
	name := acctest.RandomWithPrefix("tf-acc-product-fields")
	slug := acctest.RandomWithPrefix("tf-acc-product-field")
	var productID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckProductArchived(t, &productID),
		Steps: []resource.TestStep{
			{
				Config: testAccProductCustomFieldsConfig(name, slug, true),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "attached_custom_fields.#", "1"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "attached_custom_fields.0.custom_field_id",
						"polar_custom_field.test", "id",
					),
					resource.TestCheckResourceAttr("polar_product.test", "attached_custom_fields.0.required", "true"),
					testAccCheckProductCustomField(t, true),
					captureAttr("polar_product.test", "id", &productID),
				),
			},
			{
				ResourceName:      "polar_product.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccProductCustomFieldsConfig(name, slug, false),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_product.test", "attached_custom_fields.#", "1"),
					resource.TestCheckResourceAttrPair(
						"polar_product.test", "attached_custom_fields.0.custom_field_id",
						"polar_custom_field.test", "id",
					),
					resource.TestCheckResourceAttr("polar_product.test", "attached_custom_fields.0.required", "false"),
					testAccCheckProductCustomField(t, false),
					expectAttr("polar_product.test", "id", &productID),
				),
			},
		},
	})
}

// testAccCheckProductBenefits asserts the product's attachments server-side,
// against the IDs of the benefit resources named — in that order, since the
// list is a display order the API stores.
func testAccCheckProductBenefits(t *testing.T, benefitResources ...string) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		productID, err := stateAttribute(state, "polar_product.test", "id")
		if err != nil {
			return err
		}
		expected := make([]string, 0, len(benefitResources))
		for _, name := range benefitResources {
			benefitID, err := stateAttribute(state, name, "id")
			if err != nil {
				return err
			}
			expected = append(expected, benefitID)
		}

		product, err := testAccClient(t).GetProduct(testAccContext(t), productID)
		if err != nil {
			return fmt.Errorf("reading product %s: %w", productID, err)
		}
		attached := make([]string, 0, len(product.Benefits))
		for _, benefit := range product.Benefits {
			attached = append(attached, benefit.ID)
		}
		if !slices.Equal(attached, expected) {
			return fmt.Errorf("product %s has benefits %v, expected %v", productID, attached, expected)
		}
		return nil
	}
}

// testAccCheckProductCustomField asserts the single attachment server-side,
// including the required flag the update is expected to change.
func testAccCheckProductCustomField(t *testing.T, required bool) resource.TestCheckFunc {
	return func(state *terraform.State) error {
		productID, err := stateAttribute(state, "polar_product.test", "id")
		if err != nil {
			return err
		}
		customFieldID, err := stateAttribute(state, "polar_custom_field.test", "id")
		if err != nil {
			return err
		}

		product, err := testAccClient(t).GetProduct(testAccContext(t), productID)
		if err != nil {
			return fmt.Errorf("reading product %s: %w", productID, err)
		}
		if len(product.AttachedCustomFields) != 1 {
			return fmt.Errorf(
				"product %s has %d attached custom fields, expected 1",
				productID, len(product.AttachedCustomFields),
			)
		}
		attached := product.AttachedCustomFields[0]
		if attached.CustomFieldID != customFieldID {
			return fmt.Errorf(
				"product %s has custom field %s attached, expected %s",
				productID, attached.CustomFieldID, customFieldID,
			)
		}
		if attached.Required != required {
			return fmt.Errorf(
				"custom field %s is attached with required = %t, expected %t",
				customFieldID, attached.Required, required,
			)
		}
		return nil
	}
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

func testAccProductSeatBasedConfig(name string, middleRate int) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_product" "test" {
  name               = %[1]q
  recurring_interval = "month"

  prices = [{
    amount_type = "seat_based"

    seat_tiers = {
      tiers = [
        {
          min_seats      = 1
          max_seats      = 5
          price_per_seat = 2000
        },
        {
          min_seats      = 6
          max_seats      = 20
          price_per_seat = %[2]d
        },
        {
          min_seats      = 21
          price_per_seat = 1000
        },
      ]
    }
  }]
}
`, name, middleRate)
}

func testAccProductBenefitsConfig(name, description, first, second, benefits string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_benefit" "first" {
  type        = "custom"
  description = %[3]q

  custom = {
    note = "Granted first"
  }
}

resource "polar_benefit" "second" {
  type        = "custom"
  description = %[4]q

  custom = {
    note = "Granted second"
  }
}

resource "polar_product" "test" {
  name               = %[1]q
  description        = %[2]q
  recurring_interval = "month"

  benefits = %[5]s

  prices = [{
    amount_type  = "fixed"
    price_amount = 1000
  }]
}
`, name, description, first, second, benefits)
}

func testAccProductCustomFieldsConfig(name, slug string, required bool) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_custom_field" "test" {
  type = "text"
  slug = %[2]q
  name = "Team name"

  properties = {
    form_label = "Name of your team"
  }
}

resource "polar_product" "test" {
  name               = %[1]q
  recurring_interval = "month"

  attached_custom_fields = [{
    custom_field_id = polar_custom_field.test.id
    required        = %[3]t
  }]

  prices = [{
    amount_type  = "fixed"
    price_amount = 1000
  }]
}
`, name, slug, required)
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
