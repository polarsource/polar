import type { PolarEnvironment } from '@/schemas/Auth'

interface SetupContext {
  readonly slug: string
  readonly code: string
  readonly environment: PolarEnvironment
  readonly apiOrigin: string
  readonly dashboardOrigin: string
}

export const setupInstructions = ({
  slug,
  code,
  environment,
  apiOrigin,
  dashboardOrigin,
}: SetupContext): string => {
  const server = environment === 'production' ? 'production' : 'sandbox'
  const localNote =
    environment === 'local'
      ? `\n- This is a local Polar stack. Wherever these instructions set the SDK's server from POLAR_SERVER, construct the client with serverURL "${apiOrigin}" instead (Python: server_url), read from a POLAR_SERVER_URL entry you add to .env.`
      : ''
  const dashboardUrl = `${dashboardOrigin}/dashboard/${slug}`
  const cli = environment === 'local' ? 'dev polar' : 'npx @polar-sh/cli'
  const flag = environment === 'production' ? '' : ` --${environment}`
  const testInstruction =
    server === 'sandbox'
      ? 'It is payable with the test card 4242 4242 4242 4242, any future expiry and CVC.'
      : 'To test end-to-end without a real charge, create a 100% discount code via the discounts API; enter that code on the Polar checkout page (a plain checkout link cannot pre-apply it).'
  const goLiveNote =
    server === 'sandbox'
      ? 'the go-live steps (create a production organization and token at polar.sh, register the production webhook URL, set POLAR_SERVER=production)'
      : 'a reminder that this integration runs against the live production environment'

  return `# Set up Polar payments in this project

You are integrating Polar (https://polar.sh) — checkout and webhooks — into the codebase in the current working directory. Work through the phases below strictly in order, completing and verifying each phase before starting the next.

## Provided values — use these; never invent IDs, tokens, or URLs
- Organization: ${slug}
- Environment: ${environment}
- Dashboard: ${dashboardUrl}
- API base: ${apiOrigin}
- Setup run code: ${code}${localNote}

If a value you need is not listed above, not in .env, and not returned by a Polar API call you made, stop and ask the user — do not guess.

## Rules
1. Secrets must never appear in this conversation, in source code, or in command output. Never ask the user to paste a secret into chat — they edit .env themselves, or you pipe API responses into .env without printing them.
2. Read every file before editing it (for .env, check only which keys are present, not their values). Make minimal diffs that match the project's existing style.
3. Use the project's package manager, detected from lockfiles: pnpm-lock.yaml means pnpm, bun.lock or bun.lockb means bun, yarn.lock means yarn, package-lock.json means npm, uv.lock means uv, poetry.lock means poetry, otherwise pip.
4. Your training data about Polar may be outdated. Before writing integration code, fetch the current instructions and follow them over memory:
   - https://raw.githubusercontent.com/polarsource/agent-toolkit/main/skills/polar-integration/SKILL.md — the canonical integration guide. It wires up checkout, customer portal, and webhooks with @polar-sh/sdk directly and lists per-framework variations (Next.js, SvelteKit, Nuxt, Astro, Hono, Express, Fastify, Elysia, and more). It is written for JS/TS; for Python, apply the same approach with the polar-sdk package.
   - https://polar.sh/docs/llms.txt (an index of every docs page; fetch the API-reference pages you need, e.g. product or checkout creation).
   Important: build this on @polar-sh/sdk directly, even where the skill or docs show a per-framework @polar-sh/<framework> adapter (e.g. @polar-sh/nextjs). Using the SDK everywhere keeps the setup consistent across frameworks and languages.
5. Do not ask the user anything these instructions already answer. When you truly cannot continue without them (a browser approval, or a choice only they can make), first report your current stage as waiting (see Progress), then tell them what you need in one or two lines.

## Progress — report as you go
The user watches this setup on a page in the Polar dashboard, not this terminal. Report to it with curl: POST ${apiOrigin}/v1/agent-setup-runs/report with a JSON body. No Authorization header is needed; the setup run code identifies the run.
- A stage you start working on: {"code": "${code}", "stage": "<analyze|checkout|products>", "status": "in_progress"}
- A finished stage: {"code": "${code}", "stage": "<stage>", "note": "<one line>"}
- Whenever you stop to wait for the user: {"code": "${code}", "stage": "<the stage you are in>", "status": "waiting", "note": "<what they need to do>"}. Send this before you ask, every time: it is how they find out you are waiting. Once they have done it, report the stage as in_progress again.
- "drafts" can ride along with any report and are merged field by field, so send each finding as soon as you have it.
Stages: analyze is Phase 1, checkout is Phases 2 to 4, products is Phase 5.
Keep every note to a few words, 40 characters at most: it is shown on one line. Never put a secret in one. A report that fails must not stop the setup: carry on and mention it in your final summary.

## Phase 1 — Understand the app
Report the analyze stage as in_progress, then identify the stack: JS/TS (next, @sveltejs/kit, nuxt, astro, @remix-run/*, hono, express, fastify, elysia, or @tanstack/react-start in package.json) or Python (fastapi, django, or flask in pyproject.toml / requirements*.txt, or manage.py). Note TypeScript vs JavaScript, the src/ layout, and for Next.js which router (App vs Pages). In a monorepo, integrate the app in the current working directory. If you can't find a supported framework, tell the user which stacks are supported and stop rather than guessing.
Then find the drafts: {"products": [...], "product_description": ..., "website": ..., "support_email": ..., "socials": [...]}. If you can launch sub-agents, run these four searches in parallel, one sub-agent each, and send each result in a "drafts" report as soon as it comes back instead of waiting for the others. Each sub-agent only reads the codebase and returns its finding; you send the reports. Without sub-agents, do the searches yourself in this order.
The user approves the products and the description before they are used. The website, support email and socials are saved to the organization directly when it has none yet, so send only values you actually found in this codebase and leave the rest out:
- products: one entry per plan this app already shows on a pricing page or defines in code — {"name", "description" (optional, one line), "price_amount" (in cents), "recurring_interval" ("month", "year", or null for a one-time purchase)}. Never invent a plan or a price: if the app shows none, send an empty list.
- website: this app's public URL. Look in package.json (homepage), the README, site metadata and SEO config, deployment config (vercel.json, netlify.toml, CNAME, fly.toml) and env examples (.env.example entries such as NEXT_PUBLIC_APP_URL). A localhost address is not a website.
- support_email: the support or contact address the app shows its users (footer, contact page, email templates, legal pages, README). Never use a personal address from git config or commit history.
- socials: the app's own public profiles linked from its pages or README (X, GitHub, LinkedIn and so on), as [{"platform": "other", "url": "https://..."}]; Polar detects the platform from the URL.
When the searches are back, write product_description — two or three plain sentences on what this app sells, who it is for and how it is priced, from what you read in the code — and send the finished report: {"code": "${code}", "stage": "analyze", "note": "<framework and number of plans, e.g. Next.js, 3 plans>", "drafts": {"product_description": "..."}}.

## Phase 2 — Environment & token
Report the checkout stage as in_progress.
1. Ensure .env exists and is listed in .gitignore (fix if not).
2. Add POLAR_WEBHOOK_SECRET= and POLAR_SERVER=${server} entries if absent.
3. Get the access token with the Polar CLI. Do not ask the user to create or paste one.
   a. Run: ${cli} auth whoami. If it fails or shows another environment than ${environment}, report waiting with the note "Approve the Polar sign-in in your browser", then run: ${cli} auth login${flag}. It opens the browser and returns once the user approves.
   b. Run: ${cli} auth org ${slug}
   c. Unless .env already has a POLAR_ACCESS_TOKEN value, run: echo "POLAR_ACCESS_TOKEN=$(${cli} auth token --setup-run ${slug}#${code} --scope products:read --scope products:write --scope checkouts:read --scope checkouts:write --scope webhooks:read --scope webhooks:write)" >> .env. It puts an approve button on the setup page, waits up to five minutes for the user to click it, and writes the token straight into .env without showing it. Do not report waiting yourself for this step and do not open a browser; tell the user once: "Approve the access token on the setup page."
4. Verify without exposing it: make an authenticated GET to ${apiOrigin}/v1/products/?limit=1 (note the trailing slash — the API 307-redirects to it) reading the token from .env, following redirects, and treat any 2xx as success. On 401 or 403 the token belongs to another environment or lacks the scopes above: remove that line from .env and repeat step 3c once, then stop and tell the user.

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
1. Products. If your drafts listed plans, report the products stage as waiting with the note "Approve your plans on this page" and tell the user once: "Check the plans and prices on the setup page in the Polar dashboard and approve them." Then POST {"code": "${code}"} to the report endpoint every 5 seconds until the response has approved_at set (after 10 minutes, stop waiting and say so). Create one product per entry of the returned drafts.products with exactly the approved name, price and interval (JS: polar.products.create), skipping any whose name already exists. If your drafts listed no plans: list products, and if none exist (or all are archived) create one test product named "Test Product" with a single one-time price of $10. Record the product ids.
2. Webhooks. Do not ask the user for a URL. If the code or its deployment config names the public HTTPS URL this app is deployed at: list webhook endpoints, and unless one already targets <public-url>/api/webhook/polar create it (format raw, at least the order and customer state events), writing the returned signing secret into .env as POLAR_WEBHOOK_SECRET without printing it (e.g. pipe the response through jq). Otherwise set up local delivery: run echo "POLAR_WEBHOOK_SECRET=$(${cli} webhook listen --print-secret)" >> .env after removing the empty entry, and give the command ${cli} webhook listen <port>/api/webhook/polar in your final summary and in POLAR_SETUP.md as the way to receive webhooks while developing. Registering the production URL then becomes a go-live step.

## Phase 6 — Verify & hand off
1. Run the full typecheck/build once more. Do not block on a long-running dev server: if one isn't already running, give the user the command to start it instead of launching it yourself.
2. Give the user their first checkout link: http://localhost:<port>/checkout?products=<PRODUCT_ID>. ${testInstruction}
3. Write POLAR_SETUP.md: files created/changed, env keys added (names only, never values), product and webhook endpoint ids, a verify-before-merging checklist, a note that Polar's customer portal is already available to customers (Polar hosts it and emails them the link — no app code needed), and ${goLiveNote}.
4. Offer exactly one follow-up: "Want me to wire the webhook handlers into your database and auth so paid orders actually grant access? I'll propose the mapping before changing anything." If accepted: inspect their schema and auth, propose how to map Polar customers to app users (set external_customer_id to the app's user id at checkout, resolve it back in the webhook), get approval, then implement.
`
}
