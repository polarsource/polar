---
name: docs-writing
description: Write or edit Polar's user/developer docs in docs/ — voice, page templates for concepts and quickstart steps, multi-language code examples, links, navigation in docs.json and verification. Use when creating or rewriting a docs page, adding code examples, moving pages in the navigation, or when the user asks to tighten, review or improve docs copy.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Docs Writing (Polar)

Polar's docs live in `docs/` and are served by Mintlify. Navigation, redirects and settings are in
`docs/docs.json`. Model new pages on the ones listed under **Reference pages**.

## Voice

- Short, plain sentences. Address the reader as "you". Polar is "Polar" and only sparingly "we"
  on marketing-leaning pages, e.g the introduction.
- Lead with what something **is**, then why it matters, then how to use it.
- Cut filler and marketing speak: "world-class", "with ease", "seamlessly", "simply", "with confidence", "powerful".
- Our target audience is developers and agents - speak accordingly.
- Use plain, short and to the point language to respect the time of our visitors.
- Avoid em-dashes and too many commas.
- Confident and dry. No exclamation marks, superlatives or urgency ("Get started today!"). One
  clear next step is enough.
- Mix short sentences with the occasional fragment for emphasis: "No real money." "Polar does the
  counting." Don't overdo it.
- Use contractions in instructions ("you'll", "don't", "it's"). Keep definitions plain and
  uncontracted.
- Specifics over adjectives. Show the amount, limit, status or command instead of calling
  something fast, simple or flexible.
- State trade-offs and limitations openly, close to where they apply. A bold
  "**One trade-off:**" or a `<Warning>` beats burying it in a footnote.
- Explain **why** when Polar works a certain way, not only how ("Why usage comes first").
- Answer the obvious question directly. If the answer is no, say "No." and then explain.
- Compare categories, not competitors: "a payment provider" vs. "a Merchant of Record". Name a
  third party only when it's a fact the reader needs (Polar is built on Stripe).
- Write for a technical reader. Use MoR, MCP, webhooks, metering without apology, and define
  each once on first use.
- Call the reader a developer, not a "builder". Keep "users" for the people using the reader's
  application, and "customers" for the people paying them.
- American spelling ("organization", "optimize").
- Be concrete. Name the object, field or status (`external_id`, `active`, `customer.state_changed`)
  instead of describing it.
- Sentence-case headings ("Track usage", not "Track Usage").
- Define a term in bold the first time a page introduces it: "A **benefit** is…".
- Never promise unreleased features or dates.
- This is a public repo: no production numbers, customer names or internal data.
- `docs/security.mdx` and `SECURITY.md` must stay in sync. Edit both in the same change.

## Page templates

### Concept page (`docs/concepts/`)

1. Frontmatter `title` and a one-line `description` that says what the page explains.
2. Opening paragraph defining the object in bold.
3. A small `mermaid` flowchart of how it relates to other objects, when that helps.
4. `##` sections for the key ideas: types, statuses (as a table), lifecycle, how to read it in code.
5. `## Learn more` as a two-column table: `| Resource | Description |`, linking feature pages and
   the API reference.

Keep concept pages conceptual. Step-by-step instructions belong in feature pages or the quickstart.

### Quickstart step (`docs/quickstart/`)

1. `title` numbered ("2. Set up your catalog").
2. `<Info>` with a bold **Why now?** / **Why this matters:** line linking the matching concept page.
3. One sentence saying what the reader builds in this step.
4. `##` sections, each with one code example.
5. `## Check it worked`: what the reader should see in the sandbox dashboard.
6. `## Learn more` table, then a horizontal `<Card title="Next: …" icon="arrow-right">`.

The quickstart builds one integration end to end: usage → catalog → checkout & customers →
customer state. Keep that order everywhere it's described, including `concepts/overview`.

### Introduction and landing pages

Few words, a visible next step. Cards hold one or two lines. Prefer inline links in a card's body
over making the whole card a link when the body already links out.

## Code examples

Show every API example in TypeScript, Python and cURL, in that order and with those exact tab
titles, so Mintlify can keep the reader's language choice across code groups:

````mdx
<CodeGroup>
```typescript TypeScript
const meter = await polar.meters.create({ name: "AI tokens", ... });
```

```python Python
meter = polar.meters.create(name="AI tokens", ...)
```

```bash cURL
export METER_ID=$(curl -s -X POST https://sandbox-api.polar.sh/v1/meters/ \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H "Polar-Version: 2026-10" \
  -H "Content-Type: application/json" \
  -d '{ "name": "AI tokens", ... }' | jq -r .id)
```
</CodeGroup>
````

- **TypeScript:** `import { createPolar } from "@polar-sh/sdk/2026-10"`, client named `polar`,
  `environment: "sandbox"` in getting-started content.
- **Python:** `from polar.v2026_10 import Polar`, keyword arguments, attribute access on results
  (`meter.id`). Webhooks use `from polar.v2026_10.webhooks import validate_event`.
- **cURL:** `https://sandbox-api.polar.sh` in getting-started content, always send
  `Polar-Version`, capture IDs with `jq -r .id` into `UPPER_SNAKE` variables and reuse them as
  `"'"$METER_ID"'"` inside JSON.
- Use the **current** API version (the `/api-reference/current` redirect in `docs.json`). When it
  changes, update every hardcoded version in `docs/quickstart/` and `docs/concepts/`.
- When an example has no sensible cURL form (a webhook handler), show TypeScript and Python and
  link the raw-HTTP alternative.
- Use the same sample data across a flow: `user_123`, `jane@example.com`, the `ai_usage` event
  with `total_tokens`.

### CLI and agents, not just the dashboard

Polar is built for developers and agents. Whenever a page tells the reader to do something in the
dashboard, look for the same action in the CLI and the MCP server and show them too, visibly, for
humans as well as agents. Don't default to the dashboard alone.

Use `<Tabs>` in the order **Dashboard, CLI, Prompt**, matching "a click, command or prompt away":

````mdx
<Tabs>
  <Tab title="Dashboard">
    - Open **Products**
    - Click **New Product**
    - Add a monthly price of $20
  </Tab>
  <Tab title="CLI">
    ```bash
    polar products create --name "Pro" --recurring-interval month \
      --prices '[{ "amount_type": "fixed", "price_amount": 2000 }]'
    ```
  </Tab>
  <Tab title="Prompt">
    ```text Prompt
    Create a monthly product called Pro for $20 in my Polar sandbox organization.
    ```

    Uses the `products_create` operation of the [Polar MCP server](/integrate/mcp).
  </Tab>
</Tabs>
````

- **Dashboard:** a short list with one action per line ("Open **Products**", "Click **New
  Product**"), not a single sentence. Bold the UI labels.
- **CLI:** find the command in `docs/integrate/cli/reference/{resource}.mdx` and copy its exact
  flags. Link the reference page. Mention `polar webhook listen` wherever webhooks are tested
  locally.
- **Prompt:** the MCP server doesn't expose one tool per operation. Agents use `search` and
  `execute` to call operations named `{resource}_{action}` (e.g. `customers_get_state_external`).
  Show a plain-language prompt the reader can paste, and name the operation it uses. Take operation
  names from `docs/agents/mcp-operations.mdx`. The MCP server calls API version `2027-01`, so an
  operation's payload follows the `2027-01` schema.
- If an action exists in only one surface, show that one and don't invent the others. Say so in one
  line instead of leaving tabs empty: `<Note>API only. Not available from the CLI or MCP server.</Note>`
  or `<Note>Dashboard only.</Note>`.
- When a step asks for an access token, show `polar auth token` next to the dashboard steps.

#### Surface coverage

The CLI group and MCP prefix are the same name: `customers_get_state_external` is
`polar customers get_state_external`. These have **no CLI command and no MCP operation**, so show
the API, SDK or dashboard only:

- Creating or updating checkout sessions, and creating customer sessions (portal links).
- Ingesting or listing events.
- Creating subscriptions. Creating, finalizing or exporting orders.
- Updating the organization: every Settings toggle, embed hosts, localization, tax behavior.
- Uploading files. Validating, activating or deactivating license keys.
- Disputes (public API only).
- Balance, payouts, payout accounts, transactions, taxes, members, SSO, domains, migrations
  (dashboard only).

CLI only: `polar webhook listen|trigger`, `polar auth token`, `polar agent setup`. MCP only (API
`2027-01`): `benefit_grants_create|update|revoke`, `customer_meters_reverse_credit`.

### API versions and gated features

- Code examples use the current version, `2026-10`.
- A feature only in `2027-01` gets `<Note>Available from API version 2027-01.</Note>` and links
  `/api-reference/next/...`. Never hard-code `/api-reference/2027-01/`.
- A preview feature (granted per organization, e.g. `reset` proration, off-session charges, the
  Slack benefit) gets a `<Note>` saying it's in preview and how to request access.
- Don't document features behind an internal flag that isn't offered to merchants (config as code,
  catalog versions, subscription bulk update, `polar config`).
- Don't state a limit, policy or number you can't find in the code or confirm with the owner. Leave
  it out rather than guess.

### Product names and labels

- Title Case for product nouns: Checkout Link, Checkout Session, Customer Portal, Merchant of
  Record. Lowercase "checkout", "customer state", "sandbox".
- Copy dashboard labels from the components in `clients/apps/web/src/components/**`, not from
  memory. Settings paths look like **Settings → Subscriptions**.
- No screenshots, videos or embedded widgets. Describe the UI in text: steps with bold labels or a
  field table (UI label | API field | default).
- For API code examples, keep the TypeScript/Python/cURL `<CodeGroup>`; add a CLI command after it
  when there's a one-line equivalent.
- On feature and concept pages, a `## From the CLI or your agent` section listing the relevant
  commands and operations is enough. It doesn't need tabs for every action.

### Verify examples against the SDKs

The SDKs are generated. Check method names, parameters and result fields before publishing:

- Python: `sdk/python/polar/v{version}/services/` for methods, `inputs.py` / `outputs.py` for
  fields, `webhooks.py` for payloads.
- TypeScript: `sdk/typescript/src/{version}/`.
- HTTP paths, methods and operation names: `docs/openapi/{version}.openapi.json`.

## Links

- Internal links are root-relative without the extension: `/concepts/usage`,
  `/features/checkout/session#ad-hoc-prices`.
- Link the API reference through `/api-reference/current/{tag}/{operation-slug}` (e.g.
  `/api-reference/current/customers/list-customers`). It redirects to the current version.
  `mintlify broken-links` flags these because it doesn't follow redirects; confirm the operation
  exists in the OpenAPI spec instead.
- Link each term once per section, the first time it appears. Avoid several links pointing to the
  same page in one sentence.

## Components

- `<Info>` for context, `<Tip>` for a shortcut or alternative, `<Warning>` for something that
  costs money or access if missed.
- `<CardGroup cols={2|3}>` for navigation. `horizontal` for a single full-width call to action.
- `<Steps>` only for an ordered procedure.
- `mermaid` flowcharts `LR` with short node labels.

## Writing for agents

Agents read the same pages as Markdown: each page's `.md` URL, `llms.txt` (an index built from
page titles and descriptions) and `llms-full.txt` (every page concatenated, searched rather than
read whole).

### Descriptions

Every page's frontmatter `description` becomes its entry in `llms.txt`, and agents use it to
decide what to read. Say **when to read the page**, in one line, not a slogan:

- Good: "Verify webhook signatures and handle retries."
- Bad: "Webhooks made easy."

### Self-contained pages

Search tools return one page or chunk at a time. Make each page make sense on its own:

- State the API version when the page has code.
- Link the concepts it depends on instead of assuming the reader came from the previous page.
- Repeat a critical rule (sandbox first, `external_id`, signature checks) on the page where it
  applies, not only on an overview page.

### Agent-only content

`<Visibility for="agents">` is hidden on the website but included in the page's `.md` output and
`llms-full.txt`. `<Visibility for="humans">` is the reverse.

```mdx
<Visibility for="agents">
  Use the sandbox until the user says otherwise. Over HTTP, this is `POST /v1/products/` with
  `recurring_interval: "month"`.
</Visibility>
```

Use it for an **alternative** version of something on the page:

- Rules agents must follow: sandbox first, never expose access tokens client-side, verify webhook
  signatures, use the app's user ID as `external_id`.
- The raw API call behind a step, when the visible page shows only the CLI, agent and dashboard
  (CLI commands and MCP prompts belong in the visible page, see **CLI and agents**).
- Exact enums, fields and the webhook that fires for each change.
- A one-line text version of a `mermaid` diagram.
- Which page to read before or after this one.

Don't use it for:

- Anything a human needs: prices, limits, irreversible actions. Shared facts stay outside the
  component.
- Anything private. The `.md` output is public.
- Every page. Each block is a second copy to maintain. Use it on pages agents integrate from:
  the quickstart, customer state, webhooks, checkout.

Always pass `for` a literal string. A computed value drops the block from the Markdown output.
Check the result in the page's `.md` URL in `mint dev`.

## Navigation

- Add every new page to the right group in `docs/docs.json`. It is not generated.
- Don't add a page to more than one tab's navigation. Each listing is exported again to
  `llms-full.txt`: the shared `integrate/` pages listed in every API-version tab currently make up
  about a quarter of it as duplicates.
- Moving a page in the sidebar doesn't require moving the file. Keep the URL stable; if a URL must
  change, add a redirect in `docs.json`.
- API reference pages are generated from `docs/openapi/`. After changing public endpoints, see the
  Documentation section of the root `AGENTS.md`.

## Verify

```bash
cd docs
./node_modules/.bin/mintlify broken-links   # or: pnpm broken-links
./node_modules/.bin/mintlify dev            # preview at http://localhost:3000
```

Check `python3 -c "import json; json.load(open('docs.json'))"` after editing navigation. Preview
changed pages before calling them done, especially code-group tabs and cards.

## Reference pages

- Concept: `docs/concepts/usage.mdx`, `docs/concepts/orders-and-subscriptions.mdx`
- Quickstart step: `docs/quickstart/track-usage.mdx`
- Landing page: `docs/introduction.mdx`
