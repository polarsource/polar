# @polar-sh/cli

## 3.4.0

### Minor Changes

- eb975dc: Accept `--org` on `polar auth token`, so a token that can see several organizations can pick the one to create an access token for.

### Patch Changes

- a8698e4: Document token authentication in the help. `polar --help` and `polar auth --help` list `POLAR_ACCESS_TOKEN` and `POLAR_ENVIRONMENT` in a new ENVIRONMENT section, `polar auth token` explains that it gives your app its own organization access token approved by a human in the browser, and "Not logged in" messages mention setting `POLAR_ACCESS_TOKEN`.
- 5be63f5: `polar auth token` now says which organization and environment the token was created for, and explains how to use a sandbox token with the SDK.
- 273d629: `polar config validate` now says what it compares against. The Catalog row shows the live catalog (`v3 (live) → v4 (draft)`, or `no live catalog → v1 (draft)`). When an unpublished draft exists, validate says whether it already has the file's changes. It then suggests `polar config publish`, `polar config draft` before publishing, or `polar config draft` to discard a draft the file no longer matches. Webhook changes are reported separately, because `polar config draft` makes them right away. `--json` adds `live` and `draft`. The draft's `drift` lists the changes the draft is missing. `--pr-comment` notes the draft too.

## 3.3.0

### Minor Changes

- 2f25731: Accept `--org` on every API command that acts on an organization, and let `polar auth org <id-or-slug>` set the active organization without the interactive picker.

### Patch Changes

- 139b067: Suggest the right command for common guesses such as `polar login` and `polar auth status`, accept `--fields items.id` on list commands, and accept a JSON or comma-separated list of IDs on repeatable flags.

## 3.2.0

### Minor Changes

- 26572db: Add `polar agent setup`, which detects Claude Code, Codex and Cursor and installs the Polar plugin, MCP servers and skills for each.

## 3.1.0

### Minor Changes

- d3ae634: `polar --help` lists every command, and `polar <command> --help` shows the flags of every command under it at once.

### Patch Changes

- 2e2c654: `benefits update`, `customers update`, `customers update_external`, `customers members update`, `customers members update_external` and `products update_benefits` ask for confirmation, or `--confirm` without a terminal.

## 3.0.0

### Major Changes

- dd16120: `polar listen` and `polar trigger` are now `polar webhook listen` and `polar webhook trigger`. Add `polar auth token` to create an organization access token through the dashboard. Add `--json` to every command and `--fields` to trim API command output. Destructive API commands ask for confirmation, or `--confirm` without a terminal.

### Patch Changes

- cc6f9f5: Mark `polar webhooks reset_webhook_endpoint_secret` as destructive so it requires user confirmation.

## 2.0.2

### Patch Changes

- 77b0d35: Fix `create` commands failing with organization access tokens when `--org` is passed. The CLI sent `organization_id` in the request body, which organization tokens reject; it now sends the organization only in the `Polar-Organization` header.
- 9d2f5c8: Require confirmation when resuming a paused subscription with the CLI, since resuming starts a new billing period and charges the customer immediately.
- 4155d8e: Update `@polar-sh/sdk` to version 1.0.2.

## 2.0.1

### Patch Changes

- 96ac1df: Support detecting and updating CLI installations managed by Vite+ (`vp`).

## 2.0.0

### Major Changes

- d107912: **API resources.** Manage your Polar data straight from the terminal: `polar customers`, `products`, `orders`, `subscriptions`, `checkouts`, `discounts`, `benefits`, `meters`, `webhooks` and more.

  **`polar trigger`.** Send test webhook events to your app.

  **`polar listen`.** Forward webhooks to a port (`polar listen 3000`) or a URL and see how your server responded to each event.

  **Auth.** `polar login` and `polar logout` are now `polar auth login` and `polar auth logout`. Use `polar auth whoami` to see who you're logged in as and `polar auth org` to switch organizations.

  **Agentic experience.** JSON output (by default for API resources, with `--json` everywhere else), no hanging prompts, and errors that tell an agent exactly what to fix.

  **Everything else.** Type `polar` to see your account and active org. Windows works without WSL.
