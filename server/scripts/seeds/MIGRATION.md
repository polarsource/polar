# Seed migration: `seeds_load.py` → `dev seed2`

Goal: make `dev seed2` (the modular `scripts/seeds/` package) able to produce
everything `seeds_load.py` does, then delete `seeds_load.py` and the old
`dev seed` command.

Until parity is reached, `dev seed2`'s **Basic** and **Reset** entry points
bridge to `seeds_load.py` (`uv run task seeds_load` / `db_recreate`). **Custom**
is the modular flow; every component below shows up in its menu automatically
once registered.

Legend: `[x]` done · `[~]` partial · `[ ]` todo

## Status

**Custom is feature-complete for single-org seeding.** All 13 per-org components
are ported and live-tested — individually and all together on one org. `dev
seed2` (Custom) now produces every entity type the full demo creates for a single
org: products (fixed/one-time/seat/metered), customers, orders & subscriptions,
benefits, discounts, checkout links, meters, seats, disputes, support cases,
cost insights, access tokens, webhooks.

**Native Basic capability is complete.** Both structural pieces now exist
natively in the package and are live-tested: multi-org via `build_demo()` +
`presets.DEMO_ORGS`, and Polar-self via `seed_polar_self()` (catalog + token +
webhook + env vars). Everything `seeds_load.py` produces can now be built from
the package.

All that remains is the **Cutover** — wiring Basic to the native preset and
deleting the old file — a separate, destructive phase (see the end of this doc).

## Framework & layout

```
seeds/
  __main__.py   commands: scenarios / describe / build (--scenario|--spec) / demo
  base.py       SeedComponent, SeedContext, Variant, SeedError
  registry.py   the component list
  runner.py     dependency resolution, topo-sort, org/owner setup, build/build_demo
  events.py     shared event builders (timeline + cost spans + insert/flush)
  components/   one file per entity (12)
  presets/      scenarios.py (dev scenarios) · demo.py (multi-org demo) · polar_self.py
```

- [x] `components/` + `presets/` split out from the framework files
- [x] `presets/scenarios.py` — outcome-oriented scenarios (billing, metered, seats,
      benefits, backoffice, empty, everything) as preset specs over the components
- [x] `dev seed2` — interactive (Basic / Custom→scenario picker→Advanced / Reset) +
      non-interactive `dev seed2 <scenario> --slug … --owner …`
- [x] `scenarios` command is instant (lazy-imports the heavy runner)

## Components (Custom)

- [x] **Products** — variants `mix` / `subscriptions` / `one_time` / `seats` /
      `metered`. Seat-based (product + seat allocation) and metered (meter +
      metered product) are product *types*, so they live here as variants rather
      than as separate top-level options.
- [x] **Customers** — individual customers
- [x] **Orders & subscriptions** — real subscriptions (active/trialing) + real
      `Order` rows + order/cancellation/refund timeline events
  - [ ] variants: successful only / realistic mix (needs builder parameterization)
- [x] **Cost insights** — LLM/infra cost spans (Tinybird)
  - [ ] variants: llm / infra / mix (needs builder parameterization)
- [x] **Benefits** — custom + license keys, attached to products (requires products)
  - [ ] downloadables benefit (needs File rows)
- [x] **Discounts** — percentage discount
- [x] **Checkout links**

## More Custom components (can be added — per-org entities)

These are per-org entity types, so they *can* be selectable Custom options. They
just currently appear only in the full multi-org demo, not the single-org path.

- [x] **Disputes** — order + payment + dispute (reuses test fixtures)
- [x] **Organization access token**
- [x] **Webhook endpoint**
- [x] **Seats** — folded into the Products `seats` variant (was a separate component)
- [x] **Support cases** — dispute case (under review) around the dispute
- [x] **Org review state** — active / under review / denied + rejected appeal
      (mutates the org; runs last so entities are created while the org is active)

## Basic-only (built natively; wiring into Basic is the cutover)

Native capability now exists in the package and is live-tested. Basic still
bridges to `seeds_load.py` until the cutover flips it.

- [x] Multiple organizations — `runner.build_demo()` + `presets.DEMO_ORGS`
      (`python -m scripts.seeds demo`)
- [x] Polar-self self-integration — `polar_self.seed_polar_self()`
      (catalog + access token + webhook + returned env vars)

## Cutover (do last, in order)

- [x] Extract shared builders → `scripts/seeds/events.py` (seeds_load + the
      orders/cost_insights components now import from there)
- [x] Custom reaches full parity with Basic — verified: a Custom(all) org and a
      native-preset org with the same components match entity-for-entity
- [x] Flip **Basic** from the `seeds_load` bridge to `scripts.seeds demo` (native)
- [x] Remove the bridge helpers from `dev/cli/commands/seed2.py` (no `seeds_load`
      references left)

Native Basic now reproduces `dev seed`'s shape: **9 orgs** (8 in `DEMO_ORGS` +
`polar` via `seed_polar_self`), components distributed per-org, and the orders
component creates real `Order` rows (native `acme-corp` orders 8 = real 8).
Remaining differences come only from generic data / RNG (products 6 vs 4 from the
`mix` variant, customer counts ±) — the org set and entity types match.

- [x] Make `presets.DEMO_ORGS` faithfully reproduce `dev seed`'s 9 orgs (+ the
      orders component now creates real `Order` rows)
- [ ] Delete `scripts/seeds_load.py`
- [ ] Delete the old `dev seed` command (`dev/cli/commands/seed.py`)
- [ ] Rename `dev seed2` → `dev seed`
