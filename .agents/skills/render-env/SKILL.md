---
name: render-env
description: Add a new Terraform Cloud variable for the Render-hosted backend across production, sandbox, and test. Declares the tfe_variable in terraform/global/{production,sandbox,test}.tf and the matching variable {} block in terraform/{production,sandbox,test}/variables.tf, then reminds the user to wire it into render.tf / the render_service module.
user-invocable: true
allowed-tools: Read Edit Write Bash Grep Glob
---

# Add a Render env variable to Terraform

This skill declares a new Terraform Cloud variable so a value can be set via the TFC UI and consumed by the Render backend services. It only does the **plumbing** — it does **not** wire the variable into a Render env group. Wiring requires picking the right `*_config` / `*_secrets` object in `terraform/modules/render_service/`, which is task-specific and the user should drive.

## Inputs

The skill takes two positional args from the invocation: `/render-env <name> <description>`.

- `${name}` — the Terraform variable name in **snake_case**. Used verbatim as the TFC variable `key`, the `tfe_variable` resource suffix, and the `variable` block name. Example: `stripe_climate_api_key`.
- `${description}` — a short human-readable description. Used in the `description` attribute and (with the env appended) in the per-env tfe_variable description. Example: `Stripe Climate API key`.

If either arg is missing, ask the user before doing anything. Also ask:

- **Sensitive?** Default to `true` (almost everything in these files is sensitive). Only set `false` for non-secret config strings (cf. `slo_report_slack_channel`, `customer_portal_url_overrides`).
- **Which environments?** Default to all three (`production`, `sandbox`, `test`). The user may want to skip one — `test` in particular often omits variables that aren't exercised there.

Do **not** ask about `lifecycle { ignore_changes = [value] }`. New variables here have no `value` baked into the Terraform code, so there's nothing for Terraform to overwrite — TFC just holds whatever's typed into the UI, and `ignore_changes` would be a no-op. The handful of existing blocks that include it (e.g. `polar_organization_id`, `customer_portal_url_overrides`) seed a default `value` in code *and* want UI overrides to stick; that's a different shape from a fresh secret and the user will tell you up-front if they want it.

## Naming convention

Follow the **modern bare-key** pattern that recent additions use (e.g. `polar_access_token`, `tinybird_api_token`, `customer_portal_url_overrides`):

- The TFC `key` is the bare name: `key = "${name}"` — **no** `_production` / `_sandbox` / `_test` suffix on the key. Each variable set is per-workspace so the key doesn't need to be globally unique.
- The `tfe_variable` resource label **does** get the env suffix: `resource "tfe_variable" "${name}_${env}"`.
- The matching `variable` block in `terraform/${env}/variables.tf` uses the bare name: `variable "${name}"`. This lets `render.tf` reference it uniformly as `var.${name}` across all envs.

A handful of older variables (e.g. `google_client_id_production`, `backend_secret_production`) use a `_production`/`_sandbox`-suffixed key and matching variable. Don't replicate that pattern for new additions — it's legacy.

## Step 1: Add the tfe_variable to each global/{env}.tf

For each selected `${env}` in `production`, `sandbox`, `test`, append a block to `terraform/global/${env}.tf` (after the existing `tfe_variable` resources, before the file ends):

```hcl
resource "tfe_variable" "${name}_${env}" {
  key             = "${name}"
  category        = "terraform"
  description     = "${description} for ${env}"
  sensitive       = ${sensitive}
  variable_set_id = tfe_variable_set.${env}.id
}
```

Only add a `lifecycle { ignore_changes = [value] }` block or a `value = "..."` line if the user explicitly asks for one (rare — usually let TFC hold the value).

Use `Edit` with enough surrounding context that the insertion lands at the correct spot. Prefer appending after the last existing `tfe_variable` resource in the file rather than rewriting the file.

## Step 2: Add the variable {} block to each {env}/variables.tf

For each selected `${env}`, append a block to `terraform/${env}/variables.tf`:

```hcl
variable "${name}" {
  description = "${description}"
  type        = string
  sensitive   = ${sensitive}
}
```

Drop the `sensitive = true` line when `${sensitive}` is `false`. Drop nothing else.

## Step 3: Format

Run:

```bash
terraform fmt -recursive terraform
```

from the repo root. If `terraform` isn't on PATH, note it and skip — the formatting is a nicety, not required.

## Step 4: Hand off

Report to the user:

- The six files touched (or fewer if they skipped an env).
- That the variable is now declared but **not yet consumed**. To consume it, they need to:
  1. **Add a field to the relevant config/secrets object in `terraform/modules/render_service/variables.tf`.** Pick by purpose:
     - `backend_config` — non-sensitive backend env vars (URLs, flags, log level, tax processor list).
     - `backend_secrets` — sensitive backend env vars (API keys, tokens, signing secrets).
     - Themed `render_env_group` blocks (`stripe`, `github`, `logfire`, `tinybird`, `aws_s3`, `apple`, `prometheus`, `slo_report`, `google`, `openai`, etc.) each have their own object — use the matching one when the var belongs to a clear bucket.
     - Use `optional(string, "<default>")` if you want a module-level default; otherwise plain `string`.
  2. **Wire the field into the matching `render_env_group` block in `terraform/modules/render_service/main.tf`** as `POLAR_${NAME_UPPER} = { value = var.<object>.<field> }`. Two backend groups exist:
     - `render_env_group "backend"` — applied to **every** environment.
     - `render_env_group "backend_production"` — production-only values (e.g. `POLAR_BACKOFFICE_HOST`, `POLAR_PLAIN_TOKEN`). Put a var here when sandbox/test should not see it.
  3. **Pass the value in from each `terraform/${env}/render.tf`** module call, e.g. `backend_secrets = { ... ${field} = var.${name} ... }`. Sandbox and test won't have this line if the var is production-only.
  4. **Set the actual value in TFC** under the matching variable set (Production / Sandbox / Test).
  5. **If this is a `POLAR_*` env var, also add the field to the `Settings` class in `server/polar/config.py`** (Pydantic `BaseSettings` with `env_prefix="polar_"`; the env var name is `POLAR_<FIELD_NAME>`).

### Hardcoded string vs `tfe_variable`

Choose the right shape up-front:

- **Hardcoded in `render.tf`** (e.g. `tax_processors = "[\"stripe\"]"`): use when the value is static and you're fine editing + PR'ing terraform to change it.
- **`tfe_variable` via this skill**: use when the value is a secret or needs to be editable from the TFC UI without a code deploy. Don't hardcode a `"{}"` / `""` default in `render.tf` for something that's supposed to be UI-tunable — it defeats the point.

## Don't

- Don't write the variable into `terraform/global/main.tf` (the cross-org "Global Settings" set). Per-env sets in `global/{env}.tf` shadow it, so an entry in `main.tf` is dead weight when there's already a per-env one.
- Don't hardcode a `value = "..."` unless the user asks. The point of a `tfe_variable` is that it can be set in the TFC UI.
- Don't try to wire the variable into `render.tf` or the `render_service` module yourself — that's a structural decision (which secrets object? new object?) the user should make.
- Don't `git add` or commit. Leave the changes staged for the user to review.
