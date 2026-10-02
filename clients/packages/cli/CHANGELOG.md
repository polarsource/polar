# @polar-sh/cli

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
