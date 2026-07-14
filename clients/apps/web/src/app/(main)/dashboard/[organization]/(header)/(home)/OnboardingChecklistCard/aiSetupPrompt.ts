import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

export const buildAiSetupPrompt = (
  organization: schemas['Organization'],
): string => {
  const environment = CONFIG.IS_SANDBOX ? 'sandbox' : 'production'
  const dashboardUrl = `${CONFIG.FRONTEND_BASE_URL}/dashboard/${organization.slug}`
  const apiUrl = CONFIG.BASE_URL
  const testInstruction = CONFIG.IS_SANDBOX
    ? 'It is payable with the test card 4242 4242 4242 4242, any future expiry and CVC.'
    : 'To test end-to-end without a real charge, create a 100% discount code via the discounts API; enter that code on the Polar checkout page (a plain checkout link cannot pre-apply it).'
  const goLiveNote = CONFIG.IS_SANDBOX
    ? 'the go-live steps (create a production organization and token at polar.sh, register the production webhook URL, set POLAR_SERVER=production)'
    : 'a reminder that this integration runs against the live production environment'

  return `# Set up Polar payments in this project

You are integrating Polar (https://polar.sh) — checkout and webhooks — into the codebase in the current working directory. Work through the phases below strictly in order, completing and verifying each phase before starting the next.

## Provided values — use these; never invent IDs, tokens, or URLs
- Organization: ${organization.slug} (id: ${organization.id})
- Environment: ${environment}
- Dashboard: ${dashboardUrl}
- API base: ${apiUrl}

If a value you need is not listed above, not in .env, and not returned by a Polar API call you made, stop and ask the user — do not guess.

## Rules
1. Secrets must never appear in this conversation, in source code, or in command output. Never ask the user to paste a secret into chat — they edit .env themselves, or you pipe API responses into .env without printing them.
2. Read every file before editing it (for .env, check only which keys are present, not their values). Make minimal diffs that match the project's existing style.
3. Use the project's package manager, detected from lockfiles: pnpm-lock.yaml means pnpm, bun.lock or bun.lockb means bun, yarn.lock means yarn, package-lock.json means npm, uv.lock means uv, poetry.lock means poetry, otherwise pip.
4. Your training data about Polar may be outdated. Before writing integration code, fetch the current instructions and follow them over memory:
   - https://raw.githubusercontent.com/polarsource/skills/main/skills/polar-integration/SKILL.md — the canonical integration guide. It wires up checkout, customer portal, and webhooks with @polar-sh/sdk directly and lists per-framework variations (Next.js, SvelteKit, Nuxt, Astro, Hono, Express, Fastify, Elysia, and more). It is written for JS/TS; for Python, apply the same approach with the polar-sdk package.
   - https://polar.sh/docs/llms.txt (an index of every docs page; fetch the API-reference pages you need, e.g. product or checkout creation).
   Important: build this on @polar-sh/sdk directly, even where the skill or docs show a per-framework @polar-sh/<framework> adapter (e.g. @polar-sh/nextjs). Using the SDK everywhere keeps the setup consistent across frameworks and languages.

## Phase 1 — Detect
Identify the stack: JS/TS (next, @sveltejs/kit, nuxt, astro, @remix-run/*, hono, express, fastify, elysia, or @tanstack/react-start in package.json) or Python (fastapi, django, or flask in pyproject.toml / requirements*.txt, or manage.py). Note TypeScript vs JavaScript, the src/ layout, and for Next.js which router (App vs Pages). In a monorepo, ask which app to integrate. If you can't find a supported framework, tell the user which stacks are supported and stop rather than guessing. Report findings in two lines, then ask the only setup question now so the user can think while you work: "Does this app have a public HTTPS URL I can register for webhooks (deployed or tunneled)? If not, I'll leave webhook registration for deploy time."

## Phase 2 — Environment & token
1. Ensure .env exists and is listed in .gitignore (fix if not).
2. Add POLAR_ACCESS_TOKEN=, POLAR_WEBHOOK_SECRET=, and POLAR_SERVER=${environment} entries if absent.
3. Ask the user to create an organization access token at ${dashboardUrl}/settings (scopes: products, checkouts, and webhooks — read and write) and paste it into .env as POLAR_ACCESS_TOKEN directly in their editor, not into this chat. Wait for confirmation.
4. Verify without exposing it: make an authenticated GET to ${apiUrl}/v1/products/?limit=1 (note the trailing slash — the API 307-redirects to it) reading the token from .env, following redirects, and treat any 2xx as success. On 401 or 403, remind the user that the token must be created in the ${environment} environment (sandbox and production are separate) with the scopes listed above, then retry.

## Phase 3 — Install
Install the Polar SDK for the language: @polar-sh/sdk (JS/TS) or polar-sdk (Python). Do not add a per-framework @polar-sh/<framework> adapter — the SDK covers every framework. (Non-Polar helpers your framework genuinely needs are fine — e.g. in Python add a .env loader such as python-dotenv, since Python frameworks don't auto-load .env the way Next.js does; call it at startup.) Construct a single SDK client and reuse it across the routes, reading the environment from POLAR_SERVER (sandbox or production).

## Phase 4 — Routes
Following the polar-integration skill (use the variation for your framework), create these two routes with the SDK client (paths per the framework's conventions). The client's server comes from POLAR_SERVER — do not hardcode it, so switching environments later is only an env change.
1. Checkout — a route at /checkout driven by ?products=<id>: call the SDK's checkout create (JS: polar.checkouts.create) and redirect the user to the returned checkout URL. Do not set a success URL and do not create a confirmation page — Polar shows its own hosted confirmation after payment.
2. Webhooks — a POST route at /api/webhook/polar that verifies the signature against POLAR_WEBHOOK_SECRET before handling the event (JS: validateEvent from @polar-sh/sdk/webhooks; Python: polar_sdk.webhooks.validate_event). Handle the order-paid and customer-state-changed events with clear TODO stubs — do not invent business logic.
Do not build a customer portal route, even though the skill includes a recipe for one. Polar hosts the customer portal and already emails customers a link to it, so it needs no app code. (An in-app "Manage billing" link is optional and can be added later — leave it out.)
Then verify: build/typecheck the project (JS) or import the app module (Python) and fix any breakage before continuing.

## Phase 5 — Provision via API
Use the SDK client (or authenticated REST calls) with the token from .env, never printed. The organization access token already scopes to your organization — never pass organization_id in create calls (doing so returns 422).
1. List products. If none exist (or all existing ones are archived), create one test product named "Test Product" with a single one-time price of $10 (JS: polar.products.create), and record its id.
2. If the user provided a public URL in Phase 1: first list webhook endpoints and skip creation if one already targets this app's /api/webhook/polar URL. Otherwise create a webhook endpoint (url <public-url>/api/webhook/polar, format raw, at least the order and customer state events). The response contains the generated signing secret — write it into .env as POLAR_WEBHOOK_SECRET without printing it (e.g. pipe the response through jq). If local-only, skip and note it in the report.

## Phase 6 — Verify & hand off
1. Run the full typecheck/build once more. Do not block on a long-running dev server: if one isn't already running, give the user the command to start it instead of launching it yourself.
2. Give the user their first checkout link: http://localhost:<port>/checkout?products=<PRODUCT_ID>. ${testInstruction}
3. Write POLAR_SETUP.md: files created/changed, env keys added (names only, never values), product and webhook endpoint ids, a verify-before-merging checklist, a note that Polar's customer portal is already available to customers (Polar hosts it and emails them the link — no app code needed), and ${goLiveNote}.
4. Offer exactly one follow-up: "Want me to wire the webhook handlers into your database and auth so paid orders actually grant access? I'll propose the mapping before changing anything." If accepted: inspect their schema and auth, propose how to map Polar customers to app users (set external_customer_id to the app's user id at checkout, resolve it back in the webhook), get approval, then implement.
`
}
