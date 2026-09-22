# Void Atlas: plan

Written 2026-09-21. A small effect.institute-style teaching app for Void, built as
`clients/apps/void-atlas`. Static content, no backend, no Void API calls.
Everything the reader sees runs in the browser.

## What we are copying from effect.institute

The site is a sequence of full-viewport steps, not a docs page.

- One step at a time. Arrow keys, click, or the space bar move forward. A thin
  progress bar at the top shows where you are in the chapter.
- Two panes. Prose on the left in a narrow column, code on the right. The prose
  card is short, two to four sentences, and reads like a narrator.
- The code panel is one file that evolves. Between steps lines are added,
  removed and highlighted, and the panel animates the change instead of
  swapping snapshots. The reader never loses their place in the file.
- Some steps replace the code with a scene: a small animation that shows what
  the code does at runtime.
- Chapters are listed on the home page with a one-line summary. Each chapter is
  five to ten steps.
- Autoplay and narration exist there. We skip narration and keep autoplay as an
  optional timer.

Our version is simpler: nine chapters, no sign-in, no audio, no changelog.

## Chapters

Every chapter builds one `void.ts` file step by step and pairs it with one
scene. The code shown is real SDK code: the lesson compiles it with `compile()`
from `@void/sdk/config` and shows the IR where that helps.

Order: Config, Events and reducers, Meters and products, Identities, Ambient
identity, Signals, LLM plugin, Local events, Deploy. Reducers come before
identities so the tree scene has something concrete to fold. Deploy is last
because every earlier chapter has said "this changes the checksum" or "this
does not" by then, and the reader finally learns what that means.

### 0. Config

Short, three steps. `event` → `meter` → `defineConfig({ schema })`. Explains
that a config is a module of exports and `defineConfig` walks it. Sets up the
vocabulary the other chapters use. Scene: the exports on the left turning into
the compiled IR on the right.

### 1. Events and reducers

Code: `event<{ bytes: number; status?: string }>('crawl.page')`,
`sum(page, 'bytes')`, `count('indexed', on(page, { status: 'ok' }))`,
`on(page, { bytes: gt(1000) })`, `map(page, { kb: '$bytes / 1024' })`,
`derive('ratio', { indexed, total }, '$indexed / $total * 100')`.

Scene: an event stream on the left, a filter box in the middle, one number per
reducer on the right. Stepping records an event and shows it pass or fail the
filter and update the aggregate. Last step shows the compiled reducer JSON
(filter clauses, map, aggregation) next to the TypeScript.

Facts: filtering reads the original event, then `map` replaces the metadata;
`derive` merges inputs before applying the formula; an inline reducer takes the
meter's key; changing a deployed reducer needs a new slug.

### 2. Meters and products

Code: `meter('bandwidth', { reducer: sum(page, 'bytes'), price: usd(0.00000008) })`,
`product('pro', { price: recurring({ interval: 'month', amount: usd(49) }), meters: [included(bandwidth, 1_000_000, { limit: 'hard' })] })`,
`credits({ key: 'wallet', price: usd(0) })`, `meter.check({ estimate })`,
`meter.balance()`.

Scene: a gauge for one meter. Steps add an allowance, switch the limit between
hard and soft, add a prepaid credit bucket, and run a check that passes and
one that fails. The gauge shows `usage`, `credits`, `remaining`.

Closing two steps: bind the root to a Polar customer with
`client.api.customers.create({ external_id: root.id, email })`, then run a
check on an identity whose tree has no subscription or credits and read
`reason: 'no_plan'`. Products are billed by Polar; the binding is what connects
the tree to money.

Facts: a meter prices a scalar reducer; `included` sets an allowance with a
limit; `creditReducer` links a sum reducer as the credit side; checks compare
the estimate against every holder up the chain; no holder means denial;
reducer processing is asynchronous.

### 3. Identities

Code: `client.root('acme')`, `spawn('alice')`, `spawn('nightly')`, `chain()`,
then `cap(credits, 100)`, `deny(priority)`, `spawn(id, { entitlements })`.

Scene: a three-level tree, organization → member → agent. Recording an event
on a leaf sends a dot climbing to the root, and every node's usage counter
increments as it passes. Then entitlements narrow on the way down: the root has
the product's full terms, a child caps a meter, a grandchild loses a feature.
A `check` on a leaf walks up the chain and shows which holder limited it
(`limitedBy`, `reason`).

Facts to get right: usage folds into every ancestor; each holder's credits cover
its subtree; omitted entitlement lists inherit, empty lists deny; the customer
is bound to the root; a check spends nothing.

### 4. Ambient identity

Code: `await scope.run(async () => { ... }, { feature: 'chat' })`, then
`client.current()` inside the callback, then `client.middleware((req) => ({ identity: req.headers.get('x-user')! }))`
on a route, then `scope.headers()` on the caller side and `client.from(headers)`
in a worker across a process boundary.

Scene: a request timeline. A box labelled with the identity wraps a span of
calls; anything recorded inside the span lands on that identity with the tags.
Nested runs push and pop, concurrent runs stay separate. The last frame shows
the identity header crossing from one process to another.

Facts: context is per client, so `current()` only works on the client that
created the scope; nested runs restore the previous identity; `ensure()` with
no parent uses the ambient scope as the parent; `current()` outside a run
throws `VoidError` with `reason: 'no_scope'`; the LLM plugin's capture records
steps as the ambient identity, which is why this chapter comes before it.

### 5. Signals

Code: a meter signal with `field: 'remaining'`, `enter: { below: 100 }`,
`exit: { atLeast: 150 }`; then a semantic signal with `when`, `over: recent(1, 'hour')`,
`enter: { above: 0.7 }`, `exit: { below: 0.4 }`; then the client side,
`client.as(id).signals.budgetLow.get()` and `.listen(handler)`.

Scene: a balance line with two threshold bands. Stepping moves the balance
through 180 → 95 → 80 → 110 → 160 and the signal latches
`inactive → active → active → active → inactive`. The semantic variant shows a
noul from 0 to 1 instead of a balance, with the question text above it and the
evidence summary below.

Facts: latching happens in the SDK, but signals compile into the deployment
(ADR-0010): meter thresholds are stored for display, a semantic signal's
`when` and window are resolved by Polar by slug, so changing either is a new
version; the SDK's `docs/signals.md` predates this and is stale; one refresh
loop per identity; at most one Jev call a minute per identity and question;
unknown answers keep the last condition.

### 6. LLM plugin

Code: `llm({ key, models, gateway: vercelGateway(), billing: inCredits({ rates }), capture, classify })`,
then `included(ai.credits, 100_000)` on a product, then the route:
`streamText({ model: client.as(agentId).ai.model('anthropic/claude-sonnet-5', { gate: 'block', allow, onEnd }) })`,
then `fallback([...])`, then `scope.run(fn, tags)` for capture.

Scene: a request flowing left to right through app → `ai.model` wrapper →
gateway → provider and back. Steps light up each stage: the gate estimates
and checks; the gateway stamps identity and tags onto the request; the
provider returns usage; the wrapper records one completion event with tokens,
credits and cost; the event climbs the identity tree from chapter 3.

Closing three steps on activities: `classify: true` on the plugin, then a
completion's `metadata.call_id` grouping one call's steps into a span, then
`client.api.activities.list()` returning cost per label. The scene's pipeline
gains one more stage after ingest: a span row waiting on `due_at`, then Jev
labelling it plan, retrieve, implement, act, review or retry, and a stacked bar
of spend by label with `waste_cost` marked.

Facts: `perToken`, `costPlus`, `inCredits` are the three billing modes;
`direct()` reports no cost so cost-plus needs a gateway; `capture` records every
AI SDK call in the process as the ambient identity through the AI SDK's
telemetry hook; a wrapped model and capture coexist without double counting;
`classify` asks Polar to label completions by activity after ingest and labels
never move money; the plugin contributes the activity entry to the IR like any
of its meters, there is no standalone `activities()` (ADR-0011); spans are
grouped by `call_id` unless `classify: { span }` names another key; a span's own
row is its debounced job, so a label arrives after the sweep interval plus the
debounce, not instantly.

### 7. Local events and reconciliation

Code: `defineConfig({ schema, eventStorage: [{ type: 'sqlite', connection }] })`,
then `record({ amount: 30 }, { id })`, then `check({ estimate })` returning
`reconciliation: { applied, eventCount, remoteRemaining, localAdjustment }`,
then `balance({ reconcile: false })`, then `after(() => client.flush())` or
`waitUntil(client.flush())` on a serverless route, then swapping the adapter
for `postgresEventStorage(pool)`.

Scene: two ledgers side by side, local and server, with a balance readout
above them. Recording an event writes a row to the local ledger and the balance
moves at once, marked provisional. The server ledger catches up a beat later
and returns a receipt; the local row fades out. A second event whose upload
fails with a 503 stays local and keeps counting. A third rejected with a 4xx is
struck through and stops counting. The last frame shows the retention window
sweeping an old unconfirmed row away.

Facts: `record()` writes to every storage before the API call and the batch is
atomic per database; the server is the source of truth and local storage is a
buffer, not an archive; a check merges local events into the customer state
snapshot and deletes the ones the returned receipts confirm, in the background;
exact event IDs in bucket receipts prevent double counting; 4xx rejections
leave reconciliation until the same ID is recorded again, network errors stay
pending; nothing is retried automatically, retry with the same event ID;
`eventRetention` (default 7 days) bounds the buffer; SQLite is per process so
serverless needs Postgres or Redis; checks never reserve credits, so concurrent
requests can overspend.

### 8. Deploy and versions

Code: the `void.ts` from the earlier chapters, then `void plan`, then
`void deploy`, then `void deploy --activate`, then `defineConfig({ schema, versionId })`
pinning a draft, then `void pull`. Alongside the shell commands the panel shows
`compile(config)` output and `checksumOf(...)` so the reader sees what is
hashed.

Scene: a config diff on the left, deployment rows on the right with status
draft, active or archived and a short hash. Edits play out one by one: adding
an export creates a new draft with a new hash; changing a meter's display name
or `signalRefreshInterval` leaves the hash alone, changing a signal's question
does not (ADR-0010);
changing a reducer's filter under the same slug is refused, and giving it a new
slug creates a draft with the old slug reported as orphaned and retained.
Activating moves the row to active and the previous active to archived. A
runtime lookup arrow always points at the active row unless `versionId` pins a
draft.

Facts: the deployment is the compiled IR, hashed with SHA-256, one row per
distinct hash; pushing an identical config returns the existing deployment;
one active per organization and activation archives the previous one;
activation needs an organization that has passed Polar's review; runtime slug
lookups follow the active version and are cached for a minute, so `refresh()`
after deploying from a long-lived process; event metadata types, meter display
names, plugins' runtime options, `signalRefreshInterval` and event storage are
not in the deployment; reducer filters, maps and aggregations, meter prices and
signal thresholds and questions are; scenarios are out of scope for this round.

## App structure

```
clients/apps/void-atlas/
├── package.json              # next 16, react 19, @polar-sh/orbit, @void/sdk, shiki, motion
├── next.config.mjs           # transpilePackages: orbit, void-sdk
├── babel.config.js           # copied from po-bot (StyleX)
├── postcss.config.mjs        # copied from po-bot
├── tsconfig.json
├── public/fonts/             # copied from po-bot
└── src/
    ├── app/
    │   ├── layout.tsx        # theme cookie, fonts, Providers
    │   ├── page.tsx          # chapter list
    │   └── [chapter]/page.tsx  # server component: highlights code, renders <Lesson />
    ├── lesson/
    │   ├── types.ts          # Step, Lesson, Scene contracts (write first)
    │   ├── Lesson.tsx        # client: step state, keyboard, progress, autoplay, ?step=
    │   ├── Prose.tsx
    │   ├── CodePanel.tsx     # animated line diff over Shiki tokens
    │   ├── highlight.ts      # server: shiki codeToTokens for every step
    │   └── diff.ts           # line matching between consecutive steps
    ├── scenes/
    │   ├── ConfigToIr.tsx
    │   ├── ReducerStream.tsx
    │   ├── MeterGauge.tsx
    │   ├── IdentityTree.tsx
    │   ├── AmbientSpan.tsx
    │   ├── SignalLatch.tsx
    │   ├── LlmPipeline.tsx
    │   ├── TwoLedgers.tsx
    │   └── Deployments.tsx
    └── content/
        ├── index.ts          # ordered chapter list
        ├── config.ts
        ├── reducers.ts
        ├── meters.ts
        ├── identities.ts
        ├── ambient.ts
        ├── signals.ts
        ├── llm.ts
        ├── local-events.ts
        └── deploy.ts
```

Port 3005. Scaffolding is a copy of po-bot minus Drizzle, the AI SDK routes and
the live channel. `@void/sdk` is a dependency only so content can import
`compile` and the config helpers to show real IR.

## Contracts

These types are written first so chapters can be authored in parallel.

```ts
export interface Step {
  readonly id: string
  readonly prose: ReactNode
  /** Full file contents at this step. Omit to keep the previous step's code. */
  readonly code?: string
  /** 1-based lines to highlight. */
  readonly focus?: readonly number[]
  /** A rendered scene shown instead of, or beside, the code. */
  readonly scene?: ReactNode
  readonly layout?: 'code' | 'scene' | 'split'
}

export interface Lesson {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly steps: readonly Step[]
}

```

A scene is an ordinary client component; the chapter file renders it with the
props for that step (`<ConfigToIr ir={compile(stage)} checksum={…} />`).
React keeps the instance across steps when the element type stays the same, so
the scene animates between its props with `motion`.

Steps that omit `code` inherit the previous code, so a lesson reads as a
sequence of edits. The server page runs Shiki once per distinct code string and
passes token arrays down. `CodePanel` matches lines between the previous and
current step by content, keeps matched lines in place, fades removed lines,
slides in added ones, and dims lines outside `focus`. Motion handles the layout
animation with `layoutId` per line.

## Rendering decisions

- Shiki runs in the server component, so grammars never ship to the browser.
  The theme reads Orbit's tokens through CSS variables using Shiki's
  `css-variables` theme so light and dark come for free.
- Orbit everywhere: `Box` for layout, `Text` for prose, `Pill` for the step
  counter, `Button` for navigation. The scenes are SVG inside `Box`, using
  Orbit color tokens through `var(--...)` in the SVG attributes.
- Tone follows the dashboard. Heading scale stops at heading-xs, white surfaces,
  no display font. Mono is GeistMono from po-bot's fonts.
- Keyboard: ArrowRight / Space forward, ArrowLeft back, Escape to the chapter
  list. Step is mirrored to `?step=n` so a URL points at one step.
- Autoplay is a toggle that advances every eight seconds. No audio.
- No state persists. No database, no localStorage beyond the theme cookie
  po-bot already uses.

## Build order for one shot

Per the usual multi-agent workflow: contracts first, one worktree, never push.

**Wave 0, done 2026-09-21: scaffold and engine.** Built in
`clients/apps/void-atlas` with chapter 0 (five steps) chapter 1,
Events and reducers (seven steps, `scenes/fold.ts` interprets compiled
reducers in the browser so scenes fold real IR), and chapter 2, Meters and
products (nine steps, `scenes/balance.ts` models holder standing and checks
over compiled product terms; `ai` added as a dependency so
`@void/sdk/plugins` resolves), and chapter 3, Identities (nine steps,
`scenes/tree.ts` models subtree usage, inherited features, caps and the chain
walk of a check; `IdentityTree` reuses po-bot's offset-path pulse), and chapter 4, Ambient
identity (seven steps; `AmbientSpan` draws lanes of runs, nested spans, a
middleware request and a header crossing processes; its test drives the
real `createVoid` context with no network), and chapter 5, Signals (eight
steps; `scenes/latch.ts` mirrors the SDK's classifyMeter/classifySemantic
hysteresis and is tested against the documented sequences; the compiled
step shows both signal kinds in the IR per ADR-0010), and chapter 6, LLM
plugin (ten steps; `scenes/llm.ts` mirrors the estimate, the credits
conversion and the fallback ladder, `LlmPipeline` walks gate → gateway →
provider → completion event, then hangs the ladder, activity spans and the
by-activity report below; the real `llm()` plugin is compiled in the test,
which found that credits mode also deploys an `assistant.granted` event), and
chapter 7, Local events (nine steps; `scenes/ledger.ts` reconciles local rows
against the server balance, `TwoLedgers` shows buffer and server side by
side; the test drives the real `memoryEventStorage()` through persist,
reject, forget and pruneBefore, and reads the retention default off
`defineConfig`), and chapter 8, Deploy and versions (nine steps; every hash
shown is `checksumOf` over real definitions, the test asserts which edits
move it and that `parseIr(compile())` round-trips to the same version; the
server refuses a reducer changed under its slug with `DeploymentConflict`,
meters are `replace`d, orphans are kept and their slugs reserved).

All nine chapters are built. Remaining polish: a Wave 2 pass over prose
voice and mobile stacking, and the stale `docs/signals.md` in the SDK.

Scenes should render their final state on mount (`AnimatePresence
initial={false}`): the desktop browser pane stops firing
requestAnimationFrame while hidden, which stalls mount animations. Styling is Tailwind
and HTML with Orbit's `Button`; Box is not required in this app.

**Wave 0 as planned, one agent: scaffold and engine.** Copy po-bot's build config, write
`types.ts`, `Lesson.tsx`, `CodePanel.tsx`, `highlight.ts`, `diff.ts`, the
chapter list page and the chapter route. Ship with chapter 0 as the proof, since
it is three steps and exercises code-only, scene-only and split layouts.
Acceptance: `pnpm --filter void-atlas typecheck` passes, chapter 0 animates
between steps in the browser.

**Wave 1, eight agents in parallel: one chapter each.** Each writes
`content/<chapter>.ts` and `scenes/<Scene>.tsx` against the contracts and reads
the facts list above plus the SDK source it names. Each agent verifies its code
snippets compile by importing them in a `*.test.ts` under vitest with
`compile()` where applicable, so the shown code cannot drift from the SDK.
Acceptance: typecheck, the chapter's test, and a screenshot of every step.

**Wave 2, one agent: pass over the whole thing.** Consistent prose voice,
consistent scene palette, mobile layout stacks prose above code, lint and
format. Run `pnpm lint` and `pnpm format:check` for the app.

The deploy chapter's agent also needs `checksumOf` and `compile` in its test so
the hashes shown are the hashes the CLI would produce. The local-events agent
can drive `memoryEventStorage()` in its test to confirm the record, receipt and
rejection sequence it animates.

Estimated size: about 35 files, under 250 lines each except `CodePanel.tsx`,
which may need the same max-lines waiver Void packages already have.

## Considered and folded in

- Customers and subscriptions: two steps at the end of Meters and products.
- Activities and classify: three steps at the end of LLM plugin.
- Ambient identity could have been the tail of Identities. It is its own
  chapter because it is a separate mental model and the LLM chapter leans on
  it.

## Open choices I made

- Name: `void-atlas`. Trivial to rename before the first commit.
- Content lives in TypeScript, not MDX. Prose is JSX, code is a template
  string. This keeps one file per chapter and avoids an MDX pipeline.
- Scenes are hand-written SVG per chapter rather than a shared diagram
  engine. Five scenes is too few to justify one.
- No live Void connection. The reader learns the model, not the API's
  latency. Po Bot already covers the live version.

## Out of scope

Narration, sign-in, progress tracking, a changelog, search, exercises with
editable code, the CLI login flow, choosing between the Postgres and Redis
adapters, historical price previews, `void pull --ts` codegen, and scenarios.
Those are candidates for a second round.
