# Docs revamp plan

Scope: the **Documentation** tab of `docs/` (not the API tab). Introduction, Quickstart and Core
Concepts are already rewritten. This plan covers everything else, plus the shared pages every
Dashboard/CLI/Prompt tab depends on.

Every page follows `.agents/skills/docs-writing/SKILL.md`. Findings were checked against the code on
`feat/docs` (2026-11-24). Items marked **(verify)** have no code backing and need an owner to confirm
before they're published.

---

## Status on `feat/docs-revamp`

The plan below is implemented on this branch, with recommendations D1–D8 applied. Everything
except the items in "Still open" is done.

**Corrections to the plan, found in code while writing:**

- The merchant migration tool is **not** gated. It's open to all organizations with a finished
  onboarding and the Admin or Owner role. Only the Lemon Squeezy adapter is flagged.
- The 120-day offboarding hold is in code. Offboarding does not turn off checkout by default.
- Unit and seat tiering labels are **Fixed price per unit/seat**. Only metered prices use **Flat
  price per unit**.
- "At most one unit-based price" is true, per currency. In 2026-10, seat prices use `seat_tiers`.
- PydanticAI 2.x exposes `result.usage` as a property.
- Hard declines get one final attempt at day 21. They're not revoked right away.
- Disabling a downloadable file removes it for existing customers too.
- Creating a GitHub benefit through the API needs a user token.
- Slack benefit setup now uses the merchant's own Slack app, created from a manifest.

**Still open:**

- [ ] Run `pnpm --filter @polar-sh/cli docs:generate`. `clients/packages/cli/scripts/docs.ts` now
  emits a description per resource page. CI `docs:check` fails until the pages are regenerated.
- [ ] Regenerate `sdk/cli-commands` for the five 2027-01 operations that have no CLI command (§3.7).
- [ ] Generate `agents/mcp-operations.mdx` from the spec with a CI check. It's hand-written today.
- [ ] Changelog: stale paths ("Settings → Preferences → Embedding", "Enable subscription pause"),
  email localization claim, and two hardcoded `/api-reference/2026-10/` links in `changelog/api.mdx`.
- [ ] `clients/apps/web/src/utils/metrics.ts` describes `costs` as including Polar fees. It only sums
  `_cost` data.
- [ ] Preview every changed page in `mint dev`, especially tabs and code groups.
- [ ] Answer the owner questions below and remove or confirm the numbers they cover.

**Owner questions from implementation:**

| Area | Question |
|---|---|
| Fees | Pro/Growth/Scale rates and breakeven, Early Member cutoff (May 27, 2026), May 12, 2026 settlement cutoff |
| Payouts | 4–7 business days to the bank, forced payout of dormant balances |
| Risk | 60-day refund right, "$15" dispute fee wording, 0.4% / 0.7% chargeback rates, 120-day chargeback window, 48-hour responsiveness rule |
| Disputes | Is revoking access on a **won** dispute intended? |
| Policy | Five-year retention after leaving, support response times, security bounty |
| Product | Max file size for downloads, invoice numbering (document? where set?), `trial_ended` missing from CLI `--status` choices |
| Product | Should `checkouts create`, `customer_sessions create` and `events ingest` be in the CLI/MCP? |
| Usage | Child events whose parent never arrives stay unprocessed. `@polar-sh/ingestion` sends on API 2027-01. Label non-cost event types in the dashboard? |
| Localization | `?locale=` behavior with the flag off. Emails: English only (code) vs translated (changelog) |
| Agents | Advertise sandbox signup (`sandbox.polar.sh/auth.md`)? |
| Partnerships | Are Affonso, Fernand, Framer, Raycast and Zapier still maintained? |
| Migration | Lemon Squeezy wording and when the page becomes a how-to |
| Public? | Startup Program, fee credits |

---

## 1. Goals

1. **No screenshots.** Remove every `<img>`, `<video>`, `<iframe>` and widget. Replace each one that
   carried information with text: a short step list with bold UI labels, a field table or a code
   example.
2. **Professional and current.** Every claim, label, limit and field matches the code. Use the
   skill's voice, sentence-case headings, no em-dashes or filler, and a "when to read" description.
3. **A click, command or prompt away.** Show Dashboard, CLI and Prompt for every action that exists
   in those surfaces. Show TypeScript, Python and cURL for every API call. Say "API only" or
   "Dashboard only" where a surface doesn't exist. Never invent a command or operation.
4. **Less duplication.** The concept pages explain *what*. Feature pages explain *how*, link the
   concept once and don't re-explain it.

---

## 2. Decisions needed before writing

| # | Decision | Recommendation |
|---|---|---|
| D1 | Move the shared `integrate/*` pages (sandbox, authentication, OAT, SDKs, adapters, webhooks, OAuth) out of the three API-version tabs into a "Build" group in the Documentation tab. They're triplicated in `llms-full.txt` today. | Yes. URLs stay the same and no redirects are needed. It changes how the API tab looks. |
| D2 | Convention for features with no CLI or MCP surface (finance, settings, checkout sessions, customer sessions, event ingest). | One line, `<Note>Dashboard only. Not available from the CLI or MCP server.</Note>` (or "API only"). No empty tabs. |
| D3 | Convention for API `2027-01`-only features: manual benefit grants, manual meter credits and reversal, card-less trials, `auto` proration, `external_id` on products/discounts/meters, paid-trial `POST /v1/subscriptions/`. | Document them with `<Note>Available from API version 2027-01.</Note>` and link `/api-reference/next/...`. Never hard-code `/api-reference/2027-01/`. |
| D4 | Flag-gated features: config as code / catalog versions, the disputes dashboard and auto-accept, the merchant migration tool, the Lemon Squeezy migration, subscription bulk update, `polar config`. | Don't document config as code, bulk update or `polar config` yet. Document the disputes API (public) and mark the dashboard flow "Preview". Say that migrations require access, and how to get it. |
| D5 | Third-party integration pages (Affonso, Fernand, Framer, ParityDeals, Raycast, Zapier): mostly vendor screenshots, maintenance unknown. | Replace all six with one `features/integrations` index table (name, what it does, how it connects, external link). Redirect each old URL. ParityDeals is now EvenDeals, so redirect it to the existing EvenDeals target. |
| D6 | Production vs sandbox host in feature-page code examples. | Sandbox (`sandbox-api.polar.sh`, `environment: "sandbox"`) everywhere, with `Polar-Version: 2026-10`. Production is one sentence on the go-live page. |
| D7 | Casing of product nouns. | "Checkout Link", "Checkout Session", "Customer Portal" and "Merchant of Record" in Title Case, as product names, matching the concept pages. Lowercase "checkout" and "customer state". |
| D8 | Public or not: the Startup Program, fee credits, Polar mobile app, the WebMCP agentic checkout, `polar.metering()` with Outpost. | Document WebMCP checkout and `polar.metering()`. Ask about Outpost, the Startup Program and fee credits. |

---

## 3. Cross-cutting work

### 3.1 Screenshot and media removal

About 100 media references across 33 pages. Remove them all. "Replace" lists what the text should say.

| Page | Media | Replace with |
|---|---|---|
| features/usage-based-billing/introduction | 8 img | Page is being merged (see §5.1), nothing to replace |
| features/usage-based-billing/meters | 6 img | Steps: Products → Meters → **Create Meter** (**Name**, **Filters**, **Aggregation**, unit). Filter JSON and meter create code group |
| features/subscriptions/trials | 6 img | **Configure Trial**, **Trial duration**, **Require credit card up front**. Update Subscription → **Trial** tab |
| features/customer-management | 4 img | List of the customer detail tabs (Overview, Usage, Events, Members) and the Edit fields (**Email**, **External ID**, **Metadata**) |
| features/usage-based-billing/billing | 4 img | **Flat price per unit** / **Volume** / **Graduated**, **Amount per unit**, **Cap amount**. Portal usage: **Show metered usage** setting |
| features/usage-based-billing/credits, features/benefits/credits | 2 + 2 img | **Meter Credits** benefit fields: meter, units, rollover |
| features/tax-inclusive-pricing | 2 img | Settings → Payments → **Default tax behavior**: **Location based**, **Inclusive**, **Exclusive** |
| features/discounts | 2 img | Field table (see §5.3) |
| features/checkout/session | 2 img | "Each product shows as a selectable option in `products` order. The first is preselected." |
| features/customer-portal/introduction | 2 img | Text map: Overview, Orders, Usage, Billing (Orders and Billing need billing permission) |
| features/customer-portal/navigate-customers | 2 img | Email → 6-digit code, valid 30 minutes → portal |
| features/finance/balance | 2 img | "Finance → **Income** shows your balance and every transaction with its fees." |
| features/cost-insights/introduction | 2 img | **Remove first: it shows a real person's avatar.** One sentence on Analytics → Costs |
| features/benefits/discord-access | 3 img | Hero: none. Form: **Connected Discord server**, **Granted role**, kick on revoke |
| features/benefits/{file-downloads,github-access,license-keys} | 1 hero each | None (decorative) |
| features/checkout/embed, embed-payment-method | 1 each (absolute `polar.sh/docs` URL) | One-line description of the overlay or iframe |
| features/finance/payouts | 1 PDF iframe | Plain link to the sample reverse invoice |
| migrate.mdx | 2 animated JSX diagrams | A `mermaid` flowchart (new customers → Polar, existing → Stripe until switch) |
| features/integrations/* | 17 img, 2 video, 1 Zapier widget | Dropped with the D5 index page |
| integrate/oat (API tab, see D1) | 2 img | Steps: Settings → **Access Tokens** → **New Token**, plus `polar auth token` |

Then delete unused assets:

- **Already unused (17):** `assets/welcome.png`, `assets/introduction/checkout.*`,
  `assets/features/orders/{checkouts,detail,overview}.*`, `assets/features/integrations/evendeals/*`,
  `assets/features/finance/payouts/sample-reverse-invoice.pdf`,
  `assets/changelog/2025-10-01/launched-subscription-trials.jpeg`,
  `assets/changelog/2026-04-22/korean-checkout.png`.
- **Unused after removal (about 63):** everything under `assets/features/` except
  `checkout/session/checkout_multiple_products.*` and `orders/checkout.*`, which the changelog uses.
- **Keep:** `assets/changelog/**`, `assets/integrate/**` (webhooks, OAuth, unless D1 removes their
  screenshots too), `assets/guides/laravel/hero.jpeg`, `logo/`.
- `docs/snippets/zapier-embed.mdx` and `docs/snippets/migration-coexistence.jsx` once unused.

### 3.2 Dashboard / CLI / Prompt

Per the skill: `<Tabs>` in the order Dashboard, CLI, Prompt for actions; a `## From the CLI or your
agent` section on feature pages. Today **no feature page** has either. Only the quickstart does.

Facts every author needs:

- **Naming is shared.** CLI group = MCP prefix = OpenAPI `x-tool-name` prefix.
  `customers_get_state_external` ⇔ `polar customers get_state_external`. Nested:
  `customers_members_list` ⇔ `polar customers members list`.
- **The MCP server uses API `2027-01`** (`clients/apps/mcp/src/outbound.ts:41`). The CLI and SDK
  examples use `2026-10`. Seven MCP operations are 2027-01 only: `benefit_grants_create|update|revoke`,
  `customer_meters_credits`, `customer_meters_reverse_credit`, `meters_get_external`,
  `webhooks_get_external_webhook_endpoint`.
- **No CLI and no MCP** for these. Show the API, SDK or dashboard only:
  - Checkout session create or update (`POST /v1/checkouts/`)
  - Event ingest and list (`POST /v1/events/ingest`)
  - Customer session create (portal links, embedded payment method)
  - Subscription create
  - Order create, finalize and export (off-session charges)
  - Organization update: every setting (portal toggles, embed hosts, localization, tax behavior,
    proration default)
  - File upload
  - Disputes (public API, no CLI or MCP)
  - License key validate, activate and deactivate
  - Payouts, balance, transactions, payout accounts, members, SSO, domains, taxes, migrations
    (private API, dashboard only)
- **CLI-only:** `polar webhook listen|trigger`, `polar auth token`, `polar agent setup`,
  `customer_seats get_claim_info|claim_seat`.
- **MCP-only (CLI is likely stale, see §3.7):** `benefit_grants_create|update|revoke`,
  `customer_meters_reverse_credit`, `webhooks_get_external_webhook_endpoint`.
- **Prompts that assume "my sandbox organization"** only work when `polar-sandbox` is connected.
  The MCP page must show both servers (see §5.6).

The full resource → CLI → MCP table is in the appendix.

### 3.3 Code examples

Fix on every page in scope:

- No feature page sends `Polar-Version`. `subscriptions/manage` makes 11 calls to production
  `api.polar.sh`. Others: orders, proration, license-keys, checkout/localization.
- Use the TS/Python/cURL code group with exact tab titles and order. Off-pattern today: manage and
  proration (`cURL, Python`, `py`), checkout/session (TS + Py only), embed pages (untitled groups),
  cost-events (`json cURL` raw HTTP).
- Replace `<YOUR_BEARER_TOKEN_HERE>`, `<TOKEN>`, `async function run()` wrappers and
  `with Polar("<TOKEN>") as polar:` with the quickstart style.
- Sample data: `user_123`, `jane@example.com`, `ai_usage`, `total_tokens`. Replace `cus_123`,
  `cus_abc123`, `xxx`, `openai-usage`, `gpt-4` (including in `snippets/usage/events.mdx`).
- License-key cURL is broken (no line continuations).
- 40+ feature pages have no code at all.

### 3.4 Voice, terminology and frontmatter

- **273 em-dashes in 41 files** (analytics 43, orders 22, manage 18, meters 15). Remove.
- **24 banned filler words** ("simply", "seamless", "powerful", "easily", "with ease") and 4
  exclamation marks. Also emoji (✅/❌ on benefits/introduction, 👏🏼 on paritydeals) and 118 flag
  emoji on supported-countries.
- Setext headings, `###` without `##`, and title-case headings throughout older pages.
- "We" voice on older pages.
- **Missing descriptions (27):** supported-countries (no frontmatter at all), account-reviews,
  security, benefits/introduction, integrations/affonso, support, and 22 generated CLI reference
  pages (fix in the generator, §3.7).
- **Slogan descriptions (about 20)** to rewrite as "when to read": introduction ("tens of thousands",
  also a marketing number), fees, customer-management, customer-state, products, the four "…with
  ease" benefit pages, feature-flags, framer, raycast, paritydeals, refunds, balance,
  subscriptions/introduction, orders, customer-portal/introduction, embed pages, custom-fields, and
  the vague ones (ingestion strategies, meters, credits, custom, CLI introduction).

### 3.5 Stale dashboard labels (fix everywhere)

| Docs say | Product says |
|---|---|
| `+ New Benefit`, `+ Add Benefit` | **Create Benefit** |
| Credits (benefit type) | **Meter Credits** |
| Billing cycle "Monthly or Yearly" | **Every** N day / week / month / year |
| Pricing type "Unit-based", "Seat-based" | **Units**, **Seats** |
| "Fixed price per unit/seat", "Volume discounts" | **Flat price per unit/seat**, **Graduated**, **Volume** |
| "Enable trial period" | **Free Trial Configuration** → **Configure Trial** |
| "Enable subscription pause" | **Enable subscription pausing** |
| (missing) | **Enable subscription unit changes** |
| "Copy Embed Code" | Link page → **Embed** tab → **Copy** |
| `Copy SHA-256 Checksum` | **Copy SHA256 Checksum** |
| Meter **Preview** button | Removed |
| "Finance page" | Finance → **Income** / **Payouts** / **Taxes** / **Account** |
| "Feedback" button | **Support** |
| "Settings" (unspecified) | Settings → **Payments** / **Subscriptions** / **Customer Portal** / **Customer Notifications** / **Embedding** / **Preview Features** / **Domains** / **Notifications** |

Labels are hardcoded in components for meters, benefits and customers. Pull them from
`clients/apps/web/src/components/**`, not from memory or `en.ts` alone.

### 3.6 Factual errors that span several pages

- **"Pricing type is locked at creation" is false** (products ×4, subscriptions/introduction).
  Updating `prices` archives old prices and creates new ones of any type
  (`product/service.py:474-491`). Only the recurring interval and `meter_interval` are locked.
- **"Free" is not an API price type.** It's `fixed` with `price_amount: 0`
  (`product/schemas.py:556-583`). Fix on products, checkout/session (ad-hoc prices) and the concept
  page if it implies otherwise.
- **Price combination rules are missing.** Fixed + seat-based can combine. Custom stands alone. Free
  stands alone. Any number of metered prices. **No metered prices on one-time products**
  (`product/schemas.py:586-624`). Put this in `concepts/products.mdx` once and link it.
- **Account review is described as manual and up to 14 days** (account-reviews, support,
  acceptable-use). In the product, submitting runs an automated check (1–2 minutes). On pass you can
  accept payments right away and payouts wait for a manual review. On fail you can appeal, with a
  human reply in 1–2 business days.
- **Order statuses miss `draft` and `void`** (orders, `concepts/orders-and-subscriptions`).
- **Benefit revocation timing:** benefits stay while the subscription is `active` or `trialing`,
  including canceled-at-period-end, and are revoked when it **ends** (benefits/introduction,
  feature-flags).
- **Customer sessions now return member sessions** (`polar_mst_`, 1-hour TTL) and accept
  `external_customer_id`, `member_id`, `external_member_id`, `return_url`
  (embed-payment-method, navigate-customers).
- **The changelog contradicts the code** on email localization (says Italian and Portuguese emails;
  code sends English only) and uses stale paths ("Settings → Preferences → Embedding",
  "Enable subscription pause"). Fix the changelog entries or add a correction.

### 3.7 Tooling and generator fixes (not prose)

- [ ] Regenerate `sdk/cli-commands` and the CLI reference (`just openapi && just generate-cli`, then
  `pnpm --filter @polar-sh/cli docs:generate`). Five `cli`-tagged 2027-01 operations have no command:
  `benefit_grants create|update|revoke`, `customer_meters reverse_credit`,
  `webhooks get_external_webhook_endpoint`. Confirm with the CLI owner first.
- [ ] Add frontmatter `description` to generated CLI resource pages (`clients/packages/cli/scripts/docs.ts`).
- [ ] Generate the MCP operation table from the spec, with a CI check like `docs:check`. Today it's
  hand-synced and complete (108/108) but nothing keeps it so.
- [ ] Keep exactly one `"group": "CLI"` in `docs.json`. `scripts/docs.ts` rewrites the first match.
- [ ] Generate the supported-countries table from `StripeAccountCountry`
  (`server/polar/payout_account/schemas.py:12`).
- [ ] Update `.agents/skills/docs-writing/SKILL.md`: MCP uses 2027-01; `?codemode=false`; the
  "no CLI/MCP" list from §3.2; `polar auth token` for "create an access token" steps; the D2, D3 and
  D6 conventions; the benefit-page template (§5.2).
- [ ] Product question for the team: should `checkouts create`, `customer_sessions create` and
  `events ingest` be tagged `cli`/`mcp`? Agents commonly want "make me a checkout URL for user X".

### 3.8 Housekeeping

- [ ] Delete empty tracked files `docs/tmp.2208.json`, `docs/tmp.2308.json`.
- [ ] Fix broken redirect `/documentation/integration-guides/webhooks` → `/integrate/webhooks/intro`
  (doesn't exist). Point it at `/integrate/webhooks/endpoints`.
- [ ] Add `/api-reference` → `/api-reference/current` (the `/api*` redirects and OpenAPI descriptions
  point at it, and no page exists).
- [ ] Broken links: `/features/usage-based-billing/ingestion-strategies` (event-ingestion),
  `/features/products#variants` (subscriptions/introduction),
  `/integrate/webhooks/endpoints#verify-signature` and `/features/customer-portal` (seat guide),
  `/features/customer-portal` (benefits/custom, works only via redirect).
- [ ] Absolute `https://polar.sh/docs/...` links in support and the two embed pages → root-relative.
- [ ] Add `noindex: true` to the nine deprecated adapter pages
  (`integrate/sdk/adapters/{astro,deno,elysia,express,fastify,hono,remix,supabase,sveltekit}`).
  Keep them orphaned.
- [ ] Remove "Coming soon" stub `features/cost-insights/cost-traces` (breaks "never promise
  unreleased features").

---

## 4. Target navigation (Documentation tab)

Follows the quickstart order: usage → catalog → checkout & customers → customer state. Pure sidebar
moves keep their URLs and need no redirect. `[NEW]` pages are listed in §6.

```
Get started
  introduction
  Quickstart: overview, track-usage, catalog, checkout, webhooks, [NEW] go-live
  Concepts: overview, usage, benefits, products, customers, checkout,
            orders-and-subscriptions, money-flow, merchant-of-record/introduction
  integrate/sandbox                     (moved from API tab, D1)
  integrate/oat "Access tokens"         (moved from API tab, D1)
  Migrate: migrate (Stripe), migrate-lemon-squeezy, migrate-away (un-orphan)

Build with agents
  [NEW] agents/overview
  integrate/mcp
  [NEW] agents/mcp-operations           (generated table split from mcp.mdx)
  [NEW] agents/skills-and-plugins
  [NEW] agents/signup
  CLI   (must stay named "CLI")
    introduction, authentication, webhooks, [NEW] resources, reference
    (generated command + resource pages, collapsed)

Build                                   (D1: moved from API tab, URLs unchanged)
  SDKs, framework adapters, framework guides, webhooks, OAuth

Usage
  features/usage-based-billing/event-ingestion   "Send events"
  features/usage-based-billing/meters            "Meters"
  features/usage-based-billing/ingestion-strategies/ingestion-strategy  "Ingestion strategies" (merged)
  features/usage-based-billing/ingestion-strategies/llm-strategy        "Bill for LLM tokens"
  features/usage-based-billing/credits           "Credits" (absorbs benefits/credits)

Catalog
  features/products
  Pricing: usage-based-billing/billing, unit-based-pricing, seat-based-pricing
  features/tax-inclusive-pricing
  Benefits: benefits/introduction "Manage benefits", custom, discord-access, feature-flags,
            file-downloads, github-access, license-keys, [NEW] validate-license-keys,
            slack-shared-channel
  features/discounts

Checkout & customers
  Checkout: checkout/links, checkout/session, custom-fields, checkout/payment-methods,
            checkout/localization, [NEW] checkout/agents
  Embedded UI: checkout/embed, checkout/embed-payment-method, [NEW] checkout/embed-hosts
  Customers: customer-management, integrate/customer-state
  Customer portal: customer-portal/introduction, navigate-customers, settings,
                   [NEW] customer-portal/custom-portal

Billing operations
  features/orders
  [NEW] features/orders/off-session-charges
  Subscriptions: subscriptions/introduction, manage, proration, trials, failed-payments
  features/refunds
  [NEW] features/disputes

Analytics
  features/analytics "Metrics"
  [NEW] features/customer-analytics
  features/cost-insights/introduction "Cost insights" (merged)

Finance
  features/finance/payouts (absorbs balance), features/finance/accounts,
  [NEW] features/finance/taxes, merchant-of-record/fees (moved)

Organization
  features/team-management, features/sso, [NEW] features/domains,
  [NEW] features/notifications, [NEW] features/settings, [NEW] features/integrations

Compliance & support
  merchant-of-record/supported-countries
  Account reviews: account-reviews (with appeals), review-checklist
  merchant-of-record/acceptable-use/introduction
  security
  support (un-orphan)
```

---

## 5. Page-by-page plan

**Action key:** **Rewrite** (new structure, most text replaced) · **Edit** (fix and convert to
standard) · **Merge** (fold into another page and redirect) · **Delete** (redirect).

### 5.1 Usage

| Page | Action | Key fixes |
|---|---|---|
| usage-based-billing/introduction | **Merge** → `concepts/usage` | Duplicates concepts and quickstart. Its four steps are screenshots. Redirect. |
| usage-based-billing/event-ingestion | **Rewrite** "Send events" | TS/Python/cURL ingest with sandbox and 2026-10. **Batched production client `polar.metering()`** (100 events/batch, 1s flush, 3 retries, `flush()`/`close()`, `actor()`), undocumented today. Limits: `name` ≤128 chars, timestamp ≤5s in the future, metadata values string ≤500 / number / bool, no nesting except `_cost` and `_llm`. Dedup with `external_id` (`{inserted, duplicates}`). `parent_id`. Member attribution (`member_id`, `external_member_id`). System events and the `source` filter. Analytics → Events and the customer Events tab. Keep the backdating section. State plainly: **no CLI or MCP for ingest**. Fix the broken strategies link. Restate "Polar never blocks usage; check `active_meters[].balance`". Events for unknown customers **(verify)**. Inline `snippets/usage/events.mdx`. |
| usage-based-billing/meters | **Rewrite** "Meters" | Dashboard/CLI/Prompt for create. Filter operators with API values (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `not_like`) next to UI labels. Nested condition groups. Property paths (dot notation, ≤5 levels, `_llm.total_tokens`, `_cost.amount`). Name ≥3 chars. Filter and aggregation **lock once the meter has billed events**. Archiving and its blockers. `meters quantities`. Meter page tabs. Delete the Preview tip. Unique aggregation: "not available on most organizations" **(verify)**. |
| ingestion-strategies/ingestion-strategy + s3 + stream + delta-time | **Merge** into one "Ingestion strategies (TypeScript)" page | Requires Node ≥ 24. Payloads use `customer_id` and include `strategy`, not `customerId`. Sandbox `server` option. Errors are swallowed and logged, a trade-off to state. Pair each strategy with its meter. Fix non-compiling stream and delta-time samples. Add `PolarTraceExporter` (OpenTelemetry). Redirect the three URLs. |
| ingestion-strategies/llm-strategy | **Rewrite** "Bill for LLM tokens" | Payload uses `vendor`, not `provider`, plus `_llm` snake_case fields. `externalCustomerId: "user_123"`. AI SDK 5–7 and streaming. Python via `polar.metering()`, which replaces the "background task" advice. Companion meter recipe. `.cost()` computed from tokens. PydanticAI `result.usage()` **(verify)**. |
| usage-based-billing/credits | **Edit**, absorb `benefits/credits` | **Meter Credits** naming, intervals beyond monthly/yearly, units are integers, credits can't be granted via benefit grants. Manual credits are 2027-01 (D3). CLI `polar customer_meters credits`; reversal is MCP-only. Code group. |

### 5.2 Benefits

Use one template for every benefit type page: bold definition → what the customer gets → create it
(Dashboard/CLI/Prompt) → options table (UI label | API property | default) → customer experience →
revocation → visibility → Learn more.

| Page | Action | Key fixes |
|---|---|---|
| benefits/introduction | **Rewrite** "Manage benefits" | Create, attach (`products update_benefits`), visibility (`public`/`private`/`draft`; configurable only for custom, license keys, meter credits and feature flags; Discord, GitHub, downloads and Slack always public), description 3–42 chars, `metadata` (surfaces as `benefit_metadata`), delete revokes all grants, grant errors, webhooks. **Manual grant/revoke** (2027-01, MCP and dashboard **Grant benefit**). Fix the type list to UI labels and add Custom. Drop ✅/❌. Add description. |
| benefits/credits | **Merge** → usage-based-billing/credits | Redirect. |
| benefits/custom | **Rewrite** to template | `note` is optional. Fix the portal link. One-line history note. |
| benefits/discord-access | **Rewrite** to template | `kick_member` option. Connecting the server is dashboard-only; creating is CLI/MCP once connected. Don't document `guild_token`. Customer connection flow **(verify)**. |
| benefits/feature-flags | **Rewrite** to template | Feature flags default to **private** (hidden in the portal). Revoked when the subscription ends. Properties are empty; config lives in metadata. TS/Python/cURL reading `granted_benefits`. Agent rules in `<Visibility>`. |
| benefits/file-downloads | **Rewrite** to template | Upload via API (`files`, `service: downloadable`) then `properties.files`. `polar benefits files` for stats. No CLI upload. Bold orphan lines → `<Warning>`. "10 GB per file" **(verify)**, no cap found in code. Keep the Flagged Files section. |
| benefits/github-access | **Rewrite** to template | API values `pull`, `triage`, `push`, `maintain`, `admin`. One repo per benefit. Fix typos. Don't document `repository_id`. |
| benefits/license-keys | **Split + rewrite** | Setup page: expiration (`day`/`month`/`year`, `ttl` > 0), activations (`limit`, `enable_customer_admin`), usage, rotation, statuses table (`granted`/`revoked`/`disabled`). Responses use `customer_id`/`customer`, not `user_id`. Move integration to the new "Validate license keys" page. |
| benefits/slack-shared-channel | **Edit** | Properties table. Channel names slugified, ≤80 chars. Gating is a preview flag; "paid plan" wording **(verify)**. Sidebar title to match **Shared Slack Channel**. |

### 5.3 Catalog and pricing

| Page | Action | Key fixes |
|---|---|---|
| products | **Rewrite** "Create and manage products" | Fix the pricing-type-locked claim (×4) and "Free". Price combinations. Product **visibility** (`public`/`private`/`draft`). Card-less trials (2027-01). Settings → Payments for default currency and tax. Delete rules (no orders, subscriptions, trials or discounts). Duplicate is dashboard-only. Dashboard/CLI/Prompt and TS/Python/cURL. Move the 130-row currency table to an accordion or link the enum. Cut content the concept page owns. |
| unit-based-pricing | **Edit** | Labels (§3.5). `unit_label` per locale. Change quantity via API/CLI (`--units`); the dashboard has no Units tab **(verify claim)**. "At most one unit-based price" **(verify)**. Move the unit/seat/metered comparison to `concepts/products`. |
| seat-based-pricing | **Merge** `guides/seat-based-pricing` in, **Rewrite** | Labels. Tiers are upper bounds ("Up to"). Fixed + seat combination. `min_seats`/`max_seats` at checkout. `minimum_units`. `external_member_id`/`member_id`/`immediate_claim` on assign. Seat metrics. Remove "max 1,000 seats" **(no code backing)**. 24h claim link and 10-key/1 KB metadata are correct. Integration section from the guide: fix `resendInvitation`, versioned imports, broken links, add signature verification. Redirect the guide. |
| usage-based-billing/billing | **Rewrite top half**, keep meter-cycle half | Rename "Usage-based pricing". `metered_unit`/`metered_tiers`, `unit_amount` in cents (≤12 decimals), `cap_amount`. No metered on one-time products. Reconcile the discount warning with the meter-cycle discount rule. Behavior in `trial_ended`/paused. API example fixed + metered. |
| tax-inclusive-pricing | **Edit** | Settings → Payments → **Default tax behavior** (API `location`/`inclusive`/`exclusive`). Per-price `tax_behavior` is API/CLI only. Drop "saved automatically". |
| discounts | **Rewrite** | Definition, types table (percentage in basis points 1–10000; fixed **per currency**), duration (`once`/`forever`/`repeating` + 1–999 months). Codes 3–256 alphanumeric, case-insensitive. Fields lock after first redemption. Apply via link, `discount_code` param, checkout API and `PATCH /subscriptions` (`discount_id`, `null` to remove). Fixed-amount discounts skip meter-cycle orders. Keep per-customer limits. Dashboard/CLI/Prompt. |

### 5.4 Checkout and customers

| Page | Action | Key fixes |
|---|---|---|
| checkout/links | **Rewrite** | Missing fields **Label**, **Require billing address**, **Preset discount**. `units` via API/CLI. `locale` query param works only when localization is on. **Link** / **Embed** tabs. CLI requires `--payment-processor stripe`. Field table (label / API field / notes). Dashboard/CLI/Prompt. Link the concept instead of repeating the Link vs Session table. |
| checkout/session | **Rewrite** "Checkout sessions" | TS/Python/cURL, sandbox. Ad-hoc price types: `fixed`, `custom`, `seat_based`, `unit_based`, `metered_unit`, `metered_tiers` (no `free`). Email lock only applies to an **existing** customer. `success_url` with `{CHECKOUT_ID}`, `return_url`, `discount_id`/`allow_discount_codes`, `require_billing_address`, `is_business_customer`, prefill fields, `metadata` vs `customer_metadata`, `custom_field_data`, `currency`, `amount`, seats/units min/max, `allow_trial` and trial overrides, `subscription_id` (upgrade a free subscription), `embed_origin`, `locale`, **24h expiry**, statuses, `PATCH`, Sales → Checkouts. "API only" for create; `polar checkouts list|get` to inspect. Agent rules in `<Visibility>`. Don't document `external_products` (2027-01). |
| custom-fields | **Rewrite** | Types table (number is a 32-bit integer; date bounds are Unix timestamps in the API). `properties` keys per type. Renaming a slug is blocked once other versions exist. Values stored on checkout, order and subscription. Attach via `--attached-custom-fields`. Dashboard/CLI/Prompt. |
| checkout/payment-methods | **Edit** | Add **Alipay** and **Korean domestic cards** (`kr_card`). UPI and Korean wallets are gated by currency, not country. Minimum amounts column. Non-reusable methods excluded from subscriptions **and trials/setup**. |
| checkout/localization | **Rewrite** | Toggle at Settings → **Preview Features** → **Localized Checkout** (`feature_settings.checkout_localization_enabled`). Also localizes the Customer Portal. Precedence: `?locale=` → session `locale` → `Accept-Language`. Customer locale persists. Off by default (server forces `en`). Use `LOCALE_NAMES`. Fix the cURL (production, no version, invalid body). Query param behavior with the flag off **(verify)**. Emails English only **(verify vs changelog)**. Dashboard links to this URL, so keep it or redirect. |
| checkout/embed | **Rewrite and trim** | **Embed** tab → **Copy**. One events table instead of three examples; `success` detail is `{ successURL, redirect }`. `embed_origin` auto-added for links, required at creation for sessions. `window.Polar.EmbedCheckout`, `data-polar-checkout` on non-anchors, pin the script version. Disallowed host behavior **(verify; code suggests redirect, not API error)**. Move embed hosts to its own page. |
| checkout/embed-payment-method | **Edit** | American spelling. Token is `polar_mst_…`. Full React props. Session options and 1h TTL. Python and cURL for the session. Confirm via `customer.updated` / `list_payment_methods`. |
| customer-management | **Rewrite** "Manage customers" | Individual vs team (`type`, upgrade only), creating before purchase, metadata limits (50 keys, 40-char keys, 500-char values), customer fields, **delete and anonymize** (`anonymize=true` is API/CLI/MCP only), detail tabs and header actions, Grant benefit, Export (dashboard only), webhooks, members API. Move analytics views to the new customer analytics page. Link the concept for `external_id`. |
| integrate/customer-state | **Rewrite** "Check access with customer state" | Code first (`get_state_external` TS/Python/cURL, webhook handler). Field table: `active_subscriptions[]` (with `meters`, `seats`, `units`), `granted_benefits[]`, `active_meters[]`. Full `customer.state_changed` triggers (meter balance, license key, benefit grant changes). Per customer, not per member. `polar webhook listen`. Agent rules. Drop "rule them all". |
| customer-portal/introduction | **Rewrite** | Text map. Defaults (usage on, plan on, seats on, units off, pause off, email change off). Cancel always allowed; uncancel and retry failed payments exist. Teams and roles in the portal, seat claim flow. Localized when the flag is on. Don't document the Wallet page **(verify status)**. |
| customer-portal/navigate-customers | **Rewrite** "Link to the portal" (or merge into introduction) | 1h sessions, member sessions, `external_customer_id`, `return_url`, sandbox vs production URL, Next.js `getExternalCustomerId`. Name the emails and Settings → **Customer Notifications**. API only. |
| customer-portal/settings | **Edit** | Add **Enable subscription unit changes**. Label **Enable subscription pausing**. Group as Subscriptions / Account like the dashboard. Table: setting / API key / default / enforced in Customer Portal API. API example (`PATCH /v1/organizations/{id}`). |

### 5.5 Billing operations and analytics

| Page | Action | Key fixes |
|---|---|---|
| orders | **Rewrite and split** | Keep invoices, receipts, billing details, order export. Add `draft` and `void`. Link concept tables instead of repeating them. Invoice numbering (`organization`/`customer`) **(verify where it's set)**. Customer portal retries (max 5). Payments resource. Move off-session charges to its own page. Code group, sandbox, version. |
| refunds | **Rewrite** | Modal fields. Reasons table (public and Polar-issued `dispute_prevention`). `revoke_benefits` defaults `false` in the API, preselected in the dashboard. Blocked cases (fully refunded, disputed payment, blocked, subscription benefits). Webhooks. "Within 60 days" **(verify policy)**. Dashboard/CLI/Prompt. |
| subscriptions/introduction | **Edit, slim** | Fix pricing-type claim and price types. Broken `#variants` link. Keep renewal reminders, multiple subscriptions and API creation (free products in 2026-10; paid card-less trials from 2027-01). Customer notification email list. Export (dashboard only). Link the concept for lifecycle. |
| subscriptions/manage | **Edit** to standard | Every action gets Dashboard/CLI/Prompt tabs and a TS/Python/cURL group (sandbox, 2026-10). Map the **Update Subscription** tabs and **…** menu actions. Label fixes. Plan-change rules (not archived, allowed visibility, price in subscription currency). Units, metadata, clearing `pending_update`. `auto` is 2027-01; the CLI lacks `auto`. |
| subscriptions/proration | **Edit** | State the default (`prorate`). Python quickstart style. TS. CLI and default-setting API. |
| subscriptions/trials | **Rewrite** | Trial sources and precedence. **Card up front vs card-less** (2027-01): `trial_ended`, payment-method reminder, revoked after 14 days. Reminder rules (correct). Trial converted email. Settings → Subscriptions → **Prevent trial abuse**. `allow_trial`. Dashboard/CLI/Prompt. |
| subscriptions/failed-payments | **Edit** | Customer retries from the portal (max 5). Past due and card expiring emails. Dashboard banner. `polar payments list`, `subscriptions list --status past_due`. "Refund the failed order" **(verify or drop)**. Schedule (2/7/14/21) and grace options are correct. |
| analytics | **Rewrite** "Metrics" | How-to first (range, interval, filters, custom dashboards, CSV export are dashboard only). Then a `slug | name | definition` table per current group: Revenue, Orders, Subscriptions, Checkouts, Cancellations, Unit Economics, Costs, Usage, Seats. Add ARR, committed ARR, seat metrics, `cumulative_costs`, `active_user_by_event`, per-reason cancellations. Fix display names. `polar metrics get --metrics …`, `metrics limits`. Values in cents; FX handling **(verify)**. |
| cost-insights/introduction + cost-events + cost-traces | **Merge** into one "Cost insights" | `_cost` (Decimal, ≤17 digits, ≤12 decimals, `usd`) and `_llm` fields. Parent/child traces via `parent_id` and `PolarTraceExporter`. Analytics → Costs (breakdown, changes, by customer, anomalies, by model, by vendor, per-event-type page). Customers → Cost Drivers. Cost metrics by slug. One TS/Python/cURL example. Fix `customer_id: "cus_abc123"` (not a UUID). `aggregate_fields` is hidden from the schema; document ingest and dashboard only **(verify intent)**. Redirect two URLs. |

### 5.6 Build with agents and CLI

| Page | Action | Key fixes |
|---|---|---|
| integrate/mcp | **Edit**, retitle "MCP server" | State the API version (2027-01). Both servers in every client tab. `?codemode=false` (one tool per operation). OAT bearer tokens for headless agents. MCP event subscriptions (`events/subscribe`). A "not available via MCP" list. ChatGPT tab may be outdated, possibly a listed app **(verify)**. Move the 108-row table to the generated operations page. |
| integrate/cli/introduction | **Rewrite** "Polar CLI" | Platforms: macOS arm64/x64, Linux x64/**arm64**, **native Windows** (`install.ps1`; exact one-liner **(verify)**). Installs to `/usr/local/bin` (may sudo). Three jobs: resources, webhooks, agents. Status screen on bare `polar`. `polar update --method`. Description must mention 22 resources. |
| integrate/cli/authentication | **Edit** | Add **`polar auth token`** (`--scope`, the CLI answer to every token step). `--org` takes ID or slug. OATs are single-organization. |
| integrate/cli/webhooks | **Edit** | Port shorthand (`3000/api/webhooks`), `--print-secret`, `trigger` returns 409 unless `listen` is running. |
| integrate/cli/reference/* | Generated | Fix via the generator only (§3.7). |
| integrate/sandbox (D1) | **Rewrite** | Description. Fix "Quick Start" link (→ `/quickstart/overview`). CLI (`polar auth login --sandbox`, `POLAR_ENVIRONMENT`), sandbox MCP URL, separate tokens and data. Limitations list **(verify)**. |
| integrate/oat (D1) | **Rewrite** "Access tokens" | Remove two screenshots. `polar_oat_` prefix, scopes, revoke/rotate, environment-specific. Dashboard / CLI (`polar auth token`) tabs. No MCP. |

### 5.7 Finance, organization, compliance

| Page | Action | Key fixes |
|---|---|---|
| finance/balance | **Merge** → payouts | Finance → Income. All sales tax, not only VAT. Fees on the tax-inclusive total. Fee line types. CSV export. Redirect. |
| finance/payouts | **Rewrite** | Fix "batches 24 hours after initiation": transfers go out within about an hour; the rule is **one payout per 24 hours**. Account fee: "$2 when there's been no payout in the previous 30 days". Prerequisites: verified support email and Admin/Owner. Statuses and held payouts. Per-payout CSV. Sidebar "Payouts". Shorten 1099-K. Link instead of iframe. May 12 settlement cutoff **(verify)**. Minimums and 7-day delay are correct. |
| finance/accounts | **Edit** | Sentence case. First-run label (**Connect payout account** vs **Continue with account setup**) **(verify)**. Roles. Held payouts on swap. |
| merchant-of-record/fees | **Rewrite**, retitle "Fees", move to Finance | Settings → Billing → **Change plan**. Sandbox preview access. International fee applies to cards only. Fees on the tax-inclusive total. Dispute fee is the processor's fee ("currently $15"). Payout fees → link to payouts. Pro/Growth/Scale rates and breakeven **(verify)**. Fee credits **(D8)**. |
| team-management | **Edit** | Collapse the ownership-transfer note to one place (also remove from account-reviews FAQ). Per-member notification settings, or link the new notifications page. |
| sso | **Keep** | Link the new domains page. |
| integrations/* (6) | **Delete** (D5) | Replace with the index page. Redirect each. |
| merchant-of-record/introduction | **Edit** | One line on Finance → Taxes. Use `/support`, not `mailto:`. |
| merchant-of-record/supported-countries | **Rewrite** format | Frontmatter. Table grouped by region instead of 118 flags. Payout currency per country. List and sanctions are correct. Generate (§3.7). |
| merchant-of-record/account-reviews | **Rewrite** | Real flow: submit → automated check in minutes → accept payments → manual review → payouts released. **Appeals** section. Organization statuses relevant to merchants (`review`, `snoozed`, `denied`, `blocked`). Frontmatter. 0.4% chargeback threshold **(verify)**; don't publish internal thresholds. |
| merchant-of-record/review-checklist | **Keep** | Link to what happens after Submit. |
| merchant-of-record/acceptable-use | **Edit** | The AUP check runs at submission, not "before first payout". |
| security.mdx + SECURITY.md | **Edit both** | Capitalization, filler, bounty wording, one title ("Report a vulnerability"). |
| migrate (Stripe) | **Edit** | State the tool is gated (`merchant_migration_enabled`, off by default) and how to request access **(verify policy)**. Mermaid instead of animated diagrams. Move the 360-line agent prompt to an `<Accordion>` or `migrate/agent-prompt`. `closed` state retention **(verify)**. |
| migrate-lemon-squeezy | **Edit now, rewrite at GA** | Trim hedging and the fees paragraph (link fees). Concrete Prompt. Becomes a how-to when the Lemon Squeezy adapter flag is lifted. |
| migrate-away | **Edit**, add to nav | Sentence case. 120-day hold and 5-year retention **(verify)**. |
| support | **Rewrite**, add to nav | **Support** button (not Feedback). Review times per the new flow. Support levels by plan (link fees). Fix typo and absolute link. Description. |

### 5.8 Follow-ups on already-rewritten pages

Small fixes surfaced by the audit:

- [ ] `concepts/orders-and-subscriptions`: add `draft` and `void` order statuses.
- [ ] `concepts/products`: price combination rules, "Free = fixed 0", and the unit/seat/metered
  comparison table (moved from unit-based-pricing).
- [ ] `quickstart/track-usage` and `quickstart/checkout`: confirm their CLI/Prompt tabs don't imply
  ingest or session creation exist in the CLI or MCP. Consider `polar.metering()` as a production note.
- [ ] `introduction`: description without the marketing number. "Install Agentic Polar Skills" is
  approximate: `polar agent setup` installs the plugin (Claude Code, Codex) or MCP + skills (Cursor).
  Link the new agent pages for `auth.md` and "AI plugins".

---

## 6. New pages

| Page | Purpose | Source of truth |
|---|---|---|
| `quickstart/go-live` | Sandbox → production: production org, tokens, webhook endpoint, account review checklist. | review-checklist, oat, webhooks |
| `agents/overview` "Build with agents" | Plugin vs MCP vs CLI vs skills vs `llms.txt`, `polar agent setup`, sandbox first, what agents can't do yet. | `clients/apps/mcp`, `clients/packages/cli/src/services/agent-setup` |
| `agents/signup` | Agent signup via `polar.sh/auth.md`: anonymous registration, 1h tokens, pre-claim limits (no customers, orders, subscriptions, refunds, webhooks, OATs), claim by email. What the human sees. | `server/polar/agent/auth.md`, `agent/endpoints.py` |
| `agents/skills-and-plugins` | What `polar agent setup` installs per client; the four skills (`polar-integration`, `polar-migration`, `polar-testing`, `setup-polar`); `--skills project|global`; manual install. | `github.com/polarsource/agent-toolkit` |
| `agents/mcp-operations` | Generated operation table with the API version note. | `docs/openapi/2027-01.openapi.json` (`mcp` tag) |
| `integrate/cli/resources` | Resource command conventions: naming, `--json`, `--fields`, `--data` merge, `--org`, `--confirm`, `null` to clear, preview commands. | `sdk/cli-commands/README.md` |
| `features/benefits/validate-license-keys` | Server (`/v1/license-keys/validate|activate|deactivate`) vs public client (customer portal) endpoints, scoping with `benefit_id`/`customer_id`, TS/Python/cURL, agent rules. | `license_key/endpoints.py:231-297` |
| `features/checkout/agents` | WebMCP tools on hosted checkout (`get_checkout_state`, `set_customer_details`, `update_order`, `focus_card_number`, `submit_checkout`), not in embeds. How agents create links (CLI/MCP) and sessions (API). | `clients/packages/checkout/src/hooks/webmcp.ts` |
| `features/checkout/embed-hosts` | Allowlist rules shared by both embeds, `embed_hosts` API field, `frame-ancestors` troubleshooting. | embed.mdx, `OrganizationUpdate.embed_hosts` |
| `features/customer-portal/custom-portal` | Build your own portal: customer/member sessions, Customer Portal API surface, which settings it enforces, payment method recovery. | `customer_session/`, `customer_portal/` |
| `features/orders/off-session-charges` | Charge a saved payment method: draft → finalize, error codes (402/403/412), preview gating. TS/Python/cURL. | orders.mdx, `order/endpoints.py` |
| `features/disputes` | Lifecycle, accept vs respond with evidence (Preview), auto-accept (Preview), fees, balance impact, refunds blocked on disputed orders. Public API `list/get/accept`. | `server/polar/dispute/`, `components/Disputes/*` |
| `features/customer-analytics` | Customers overview, **Top Customers**, **At Risk** (past due + scheduled cancellations), **Cost Drivers**. Dashboard only. | `customers/{top,at-risk,cost-drivers}` |
| `features/finance/taxes` | Finance → Taxes per jurisdiction, income CSV export. Possibly the 1099-K content. | `finance/taxes/TaxesPage.tsx`, `server/polar/tax/` |
| `features/domains` | Verify domains via DNS TXT. Required for SSO, used for embed hosts and the website check. | `organization_domain/` |
| `features/notifications` | Team notifications per member (orders, subscriptions, trials, renewals, cancellations, chargeback prevention, exclude free) and customer email settings (13 toggles). | `models/user_organization.py:24-34`, `models/organization.py:130-160` |
| `features/settings` | One reference map of every Settings section with anchors other pages link to. Useful for agents. | `components/Settings/settingsSections.ts` |
| `features/integrations` | Index table of third-party integrations (D5). | n/a |
| Account reviews → Appeals (section or page) | Appeal form, AI first pass, human reply in 1–2 business days. | `AppealForm.tsx`, `organization_review/appeal_case.py` |
| Later (gated) | Config as code / catalog versions / `polar config`; subscription bulk update. | `catalog/`, `declarative_config/` |

---

## 7. Redirects to add

| From | To |
|---|---|
| `/features/usage-based-billing/introduction` | `/concepts/usage` |
| `/features/benefits/credits` | `/features/usage-based-billing/credits` |
| `/features/usage-based-billing/ingestion-strategies/s3-strategy` | `/features/usage-based-billing/ingestion-strategies/ingestion-strategy#s3` |
| `/features/usage-based-billing/ingestion-strategies/stream-strategy` | `…/ingestion-strategy#stream` |
| `/features/usage-based-billing/ingestion-strategies/delta-time-strategy` | `…/ingestion-strategy#delta-time` |
| `/features/usage-based-billing/ingestion-strategies` | `…/ingestion-strategy` |
| `/features/cost-insights/cost-events` | `/features/cost-insights/introduction#cost-events` |
| `/features/cost-insights/cost-traces` | `/features/cost-insights/introduction#traces` |
| `/guides/seat-based-pricing` | `/features/seat-based-pricing` |
| `/features/finance/balance` | `/features/finance/payouts` |
| `/features/integrations/{affonso,fernand,framer,raycast,zapier}` | `/features/integrations` (or the vendor's page) |
| `/features/integrations/paritydeals` | EvenDeals target already used in `docs.json` |
| `/documentation/integration-guides/webhooks` | `/integrate/webhooks/endpoints` (fix existing) |
| `/api-reference` | `/api-reference/current` |

Check incoming links from the dashboard before removing any URL. For example,
`clients/apps/web/src/components/Settings/FeatureSettings.tsx:86` links `/features/checkout/localization`.
Grep `clients/` and `server/` for `polar.sh/docs/`.

---

## 8. To verify with owners

| Item | Page | Ask |
|---|---|---|
| 10 GB file limit (no cap in code) | benefits/file-downloads | Product |
| Unique aggregation "disabled for new accounts" | meters | Product |
| Slack benefit "paid plan" vs preview flag | slack-shared-channel | Product |
| Max 1,000 seats per subscription (no code) | seat-based-pricing | Product |
| At most one unit-based price per product | unit-based-pricing | Product |
| Quantity changes from the dashboard (no Units tab found) | unit-based-pricing | Product |
| What happens to events for unknown customers | event-ingestion | Backend |
| `aggregate_fields` hidden on purpose | cost insights | Backend |
| Is Outpost ready to document | event-ingestion | SDK |
| PydanticAI `result.usage()` API | llm-strategy | SDK |
| Discord and GitHub customer connection flow | benefits | Product |
| Embed on a disallowed host: redirect or error | checkout/embed | Test in a browser |
| `?locale=` honored with the flag off | localization | Frontend |
| Emails translated (changelog) vs English only (code) | localization, changelog | Frontend |
| Customer portal Wallet page status | customer-portal | Product |
| Invoice numbering: where it's set | orders | Product |
| "Refund the failed order" advice | failed-payments | Product |
| Refund window "within 60 days" | refunds, fees | Policy |
| Pro/Growth/Scale rates and breakeven | fees | Finance |
| May 12, 2026 settlement cutoff | payouts | Finance |
| Dormant-balance forced payout | payouts, fees | Finance |
| 0.4% / 0.7% chargeback thresholds | account-reviews | Risk |
| 120-day hold and 5-year retention when leaving | migrate-away | Policy |
| Migration tool access policy and `closed` retention | migrate | Product |
| Third-party integrations still maintained | integrations | Partnerships |
| ChatGPT: listed app or custom connector | mcp | Product |
| Windows install one-liner | cli/introduction | CLI |
| Missing CLI commands for 2027-01 ops intentional? | CLI reference | CLI |
| Startup Program, fee credits: public? | fees | Product |
| Sandbox limitations list complete | sandbox | Product |

---

## 9. Suggested order

1. **Foundations.** Decide D1–D8. Update the docs-writing skill. Housekeeping (§3.8). Generator
   fixes (§3.7).
2. **Agent backbone.** MCP, CLI pages, sandbox, access tokens, new agent pages. Every other page's
   CLI and Prompt tabs link here.
3. **Integration-critical pages** (agents integrate from these): customer state, send events,
   meters, checkout sessions, validate license keys, feature flags, go-live.
4. **Catalog and billing:** products, pricing, discounts, credits, subscriptions, trials, orders,
   off-session charges, refunds, disputes.
5. **Checkout and portal:** links, custom fields, payment methods, localization, embeds, portal.
6. **Benefits** on the shared template.
7. **Analytics:** metrics, customer analytics, cost insights.
8. **Finance, organization, compliance, migrate, support, integrations index.**
9. **Asset cleanup and final checks:** delete unused assets, `pnpm broken-links`, validate
   `docs.json`, preview tabs and code groups in `mint dev`, and check `.md` output for
   `<Visibility>` blocks.

Each page is done when it has: a "when to read" description; no media; the TS/Python/cURL group on
2026-10 and sandbox; Dashboard/CLI/Prompt (or an explicit "only" note); a Learn more table; labels
checked against components; and no claims left marked **(verify)**.

---

## Appendix: resource → CLI → MCP

CLI group and MCP prefix are identical. † = API 2027-01 only.

| Resource | CLI | MCP prefix | Actions | Not in CLI or MCP |
|---|---|---|---|---|
| Organizations | `polar organizations` | `organizations_` | list, get | create, update |
| Products | `polar products` | `products_` | list, create, get, update, delete, update_benefits | duplicate (dashboard) |
| Benefits | `polar benefits` | `benefits_` | list, create, get, update, delete, files, grants | |
| Benefit grants | `polar benefit_grants` | `benefit_grants_` | list; MCP only: create†, update†, revoke† | |
| Checkout links | `polar checkout_links` | `checkout_links_` | list, create, get, update, delete | |
| Checkout sessions | `polar checkouts` | `checkouts_` | list, get | create, update, client_* |
| Custom fields | `polar custom_fields` | `custom_fields_` | list, create, get, update, delete | |
| Discounts | `polar discounts` | `discounts_` | list, create, get, update, delete | |
| Customers | `polar customers` | `customers_` | list, create, get, update, delete, *_external, get_state, get_state_external, list_payment_methods(_external) | customer sessions |
| Customer members | `polar customers members` | `customers_members_` | list, create, get, update, delete (+ external) | |
| Customer seats | `polar customer_seats` | `customer_seats_` | list_seats, assign_seat, revoke_seat, resend_invitation; CLI only: get_claim_info, claim_seat | |
| Subscriptions | `polar subscriptions` | `subscriptions_` | list, get, update, revoke | create |
| Orders | `polar orders` | `orders_` | list, get, update, invoice, generate_invoice, receipt | create, finalize, export |
| Refunds | `polar refunds` | `refunds_` | list, create | |
| Payments | `polar payments` | `payments_` | list, get | |
| Disputes | none | none | | list, get, accept |
| Events | `polar events` | `events_` | list_names, get | ingest, list |
| Event types | `polar event_types` | `event_types_` | list, update | |
| Meters | `polar meters` | `meters_` | list, create, get, update, quantities, get_external† | |
| Customer meters | `polar customer_meters` | `customer_meters_` | list, get, credits†; MCP only: reverse_credit† | |
| License keys | `polar license_keys` | `license_keys_` | list, get, update, rotate, get_activation | validate, activate, deactivate |
| Files | `polar files` | `files_` | list, delete | create/upload, update |
| Metrics | `polar metrics` | `metrics_` | get, limits | dashboards, export |
| Webhook endpoints | `polar webhooks` | `webhooks_` | list/create/get/update/delete endpoint, reset secret, list deliveries, redeliver; MCP only: get_external† | |
| Local webhooks | `polar webhook listen`, `trigger` | none | CLI only | |
| Auth and tokens | `polar auth login/logout/whoami/list/org/token` | none (OAuth on connect) | CLI only | |
| Agent setup | `polar agent setup` | n/a | CLI only | |
| Docs search | none | `search_docs`, `read_docs_page` | MCP only | |
