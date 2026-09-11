resource "polar_meter" "prompt_tokens" {
  name = "Prompt Tokens"
  unit = "token"

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = "llm_usage"
    }]
  }

  aggregation = {
    func     = "sum"
    property = "prompt_tokens"
  }
}
