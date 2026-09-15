package provider

import (
	"fmt"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/acctest"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
)

func TestAccCustomFieldResource(t *testing.T) {
	slug := acctest.RandomWithPrefix("tf-acc-field")
	var customFieldID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckCustomFieldDestroyed(t, &customFieldID),
		Steps: []resource.TestStep{
			{
				Config: testAccCustomFieldTextConfig(slug, "VAT number", "EU VAT number"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("polar_custom_field.test", "id"),
					resource.TestCheckResourceAttrSet("polar_custom_field.test", "organization_id"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "type", "text"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "slug", slug),
					resource.TestCheckResourceAttr("polar_custom_field.test", "name", "VAT number"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.form_label", "EU VAT number"),
					captureAttr("polar_custom_field.test", "id", &customFieldID),
				),
			},
			{
				ResourceName:      "polar_custom_field.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			// The slug is the key values are stored under, and it is mutable:
			// changing it must update in place rather than force a replacement.
			{
				Config: testAccCustomFieldTextConfig(slug+"-v2", "Tax number", "EU tax number"),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_custom_field.test", "slug", slug+"-v2"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "name", "Tax number"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.form_label", "EU tax number"),
					expectAttr("polar_custom_field.test", "id", &customFieldID),
				),
			},
		},
	})
}

// TestAccCustomFieldResourceSelect covers the select type, the only one whose
// properties carry a required nested list.
func TestAccCustomFieldResourceSelect(t *testing.T) {
	slug := acctest.RandomWithPrefix("tf-acc-select")
	var customFieldID string

	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		CheckDestroy:             testAccCheckCustomFieldDestroyed(t, &customFieldID),
		Steps: []resource.TestStep{
			{
				Config: testAccCustomFieldSelectConfig(slug, `
      { value = "small", label = "Small" },
      { value = "large", label = "Large" },
`),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_custom_field.test", "type", "select"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.#", "2"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.0.value", "small"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.0.label", "Small"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.1.value", "large"),
					captureAttr("polar_custom_field.test", "id", &customFieldID),
				),
			},
			{
				ResourceName:      "polar_custom_field.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
			{
				Config: testAccCustomFieldSelectConfig(slug, `
      { value = "small", label = "Small" },
      { value = "medium", label = "Medium" },
      { value = "large", label = "Large" },
`),
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.#", "3"),
					resource.TestCheckResourceAttr("polar_custom_field.test", "properties.options.1.value", "medium"),
					expectAttr("polar_custom_field.test", "id", &customFieldID),
				),
			},
		},
	})
}

func testAccCheckCustomFieldDestroyed(t *testing.T, id *string) resource.TestCheckFunc {
	return expectDeleted(t, "custom field", id, testAccClient(t).GetCustomField)
}

func testAccCustomFieldTextConfig(slug, name, formLabel string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_custom_field" "test" {
  type = "text"
  slug = %[1]q
  name = %[2]q

  properties = {
    form_label = %[3]q
  }
}
`, slug, name, formLabel)
}

func testAccCustomFieldSelectConfig(slug, options string) string {
	return providerConfig + fmt.Sprintf(`
resource "polar_custom_field" "test" {
  type = "select"
  slug = %[1]q
  name = "Size"

  properties = {
    form_label = "Preferred size"
    options = [%[2]s]
  }
}
`, slug, options)
}
