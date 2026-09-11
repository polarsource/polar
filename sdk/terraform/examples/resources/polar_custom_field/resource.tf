resource "polar_custom_field" "company_size" {
  type = "select"
  slug = "company_size"
  name = "Company size"

  properties = {
    form_label = "How big is your team?"
    options = [
      { value = "solo", label = "Just me" },
      { value = "small", label = "2-10" },
      { value = "large", label = "11+" },
    ]
  }
}
