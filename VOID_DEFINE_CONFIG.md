# Proposal: one `defineConfig({...})` that is the SDK

Status: draft for discussion. Written 2026-09-15.

## Why

Today a void config is a *module of exports*. You import `event`, `on`, `sum`,
`meter`, `product`, `included`, `entitlement` and friends, build free-floating
values, and `defineConfig({ schema })` walks the module reflectively to find
them. It works, but it has costs that show up the moment someone reads a
config for the first time:

- The definition is scattered. Which meters exist is the answer to "which
  exports happen to be `MeterDef`s", including ones nested under products.
- Names are doubled. `creditsPurchased` (the export) and
  `'credits.purchased'` (the event) are both identities, and the runtime
  client uses the former while the server uses the latter.
- Wiring is positional and nested. `meter('tokens', { reducer: sum(on(completion, { model: 'x' }), 'input_tokens') })`
  reads inside out, and the relationship *between* things (this product
  includes that meter with these terms) is expressed by object identity, not
  by name.
- Plugins are a second language. `llmTokens(...)` returns something that is
  both a `PluginDef` and a bag of meters, with its own `schema`, `runtime`
  and `snapshot` hooks and reserved-name rules.

The proposal is to replace all of that with a single declarative object, and
to make the *type* of that object the type of the SDK.

```ts
import { defineConfig, usd } from '@void/sdk'

export const config = defineConfig({
  events: { ... },
  folds: { ... },
  meters: { ... },
  entitlements: { ... },
  products: { ... },
})

export const void_ = config.connect({ apiUrl, token })
```

Everything below is one config, one client, one set of names.

## Design principles

1. **One tree, named keys.** Every definable thing lives under a section and
   is identified by its key. The key is the deploy slug. There is no separate
   export name.
2. **References by name, checked by the compiler.** A fold references an
   event by key, a meter references a fold by key, a product references
   meters and entitlements by key. Typos and dangling references are type
   errors, not deploy errors.
3. **The definition is the type.** `defineConfig` uses a `const` generic so
   the literal object becomes the type parameter. The client derived from it
   has exactly these events, folds, meters, products and entitlements, with
   payload types flowing from the event definitions into `record`, `sum`,
   `where` and so on.
4. **Inline where it reads better, named where it is shared.** A meter can
   declare its fold inline. A fold gets its own entry only when two things
   need it, or when it is a derived metric.
5. **Plain data, plus schemas.** Apart from event schemas and a few tagged
   helpers (`usd`, comparison operators) the config object is JSON-shaped.
   Schemas compile to JSON Schema, so the whole thing can still be printed,
   diffed, hashed and, later, rendered by the dashboard's Definition pages.
6. **Presets, not plugins.** Reusable billing patterns are functions that
   return config fragments. They compose by merging, at the value level and at
   the type level, and they add nothing the user could not have written by
   hand.

## The definition

### Events

```ts
import { z } from 'zod'

events: {
  'llm.completion': z.object({
    model: z.string(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cached_input_tokens: z.number().int().nonnegative().optional(),
    feature: z.string().optional(),
  }),
  'ticket.opened': z.object({ ticket_id: z.string() }),
  'ticket.closed': z.object({
    ticket_id: z.string(),
    resolution: z.enum(['solved', 'unresolved']),
  }),
  'credits.purchased': z.object({ amount: z.number().positive(), pack: z.string() }),
}
```

An event's payload is a schema. Zod is the documented default and the only
library the SDK ships an adapter for, but `defineConfig` accepts any object
implementing [Standard Schema](https://standardschema.dev) (`zod`, `valibot`,
`arktype`), so the SDK itself has no schema dependency and users keep the
library they already have.

The schema does three jobs at once:

- **Types.** The payload type is the schema's inferred output
  (`StandardSchemaV1.InferOutput`), so `record()`, `sum`, `where` and the
  event listing are typed with nothing else declared. Enums narrow `where`:
  `resolution` is `'solved' | 'unresolved'`, not `string`.
- **Producer-side validation.** `record()` parses the payload before sending.
  A malformed event fails in the app with the library's own error instead of
  at the server, or worse, silently.
- **Server-side validation and display.** The compiler emits the schema's
  JSON Schema into the deployment. The server can validate ingestion against
  it, and the dashboard's Events page can render the shape from it.

Rules `defineConfig` enforces at runtime, because the type system cannot:

- The schema must describe an object whose output is JSON-shaped. Transforms
  that produce class instances, functions or `Date`s are rejected.
- Top-level keys must be plain identifiers, since folds reference them by
  name (`sum: 'input_tokens'`).
- JSON Schema is derived through the adapter for the library in use. Zod 4
  produces it natively (`z.toJSONSchema`). For other Standard Schema
  libraries without an adapter the event still types and validates on the
  producer side, and the deployment carries no server-side schema.

Today's `event<{...}>('name')` becomes unnecessary, and so does the type-only
metadata declaration: the schema is the single source of the payload's shape.
The dotted event name is the key, and the client addresses it by that key:
`client.as(id).events('llm.completion').record({...})`. See the naming
discussion below.

### Folds

A fold reduces a stream of one event into a value per identity. The word
replaces "reducer" in the public API; the server keeps calling them reducers
and the compiler maps one to the other.

```ts
folds: {
  completions: { on: 'llm.completion', count: true },
  input_tokens: { on: 'llm.completion', sum: 'input_tokens' },
  premium_input_tokens: {
    on: 'llm.completion',
    where: { model: 'gpt-4o' },
    sum: 'input_tokens',
  },
  purchased_credits: { on: 'credits.purchased', sum: 'amount' },
  latest_plan: { on: 'plan.changed', last: true },
  margin: {
    derive: { revenue: 'usage_revenue', cost: 'usage_cost' },
    expression: '(revenue - cost) / revenue',
  },
}
```

- `on` must be a key of `events`. `where` is typed against that event's
  payload: keys are payload fields, values are literals or comparison helpers
  (`gt(10)`, `not('x')`, `like('gpt-%')`), exactly as today.
- Exactly one aggregation: `count: true`, `sum: <numeric field>`,
  `min`/`max: <numeric field>`, `first`/`last: true`. `sum` only accepts
  fields whose inferred type is `number` or `number | undefined`.
- `derive` names other scalar folds; the expression references those names.
  Same rules as today's `derive`, moved into data.
- `map` (project fields before aggregating) stays available as
  `map: { credits: 'input_tokens / 1000' }` when it is needed.

### Meters

A meter prices a scalar fold. It can name a fold or declare one inline; an
inline fold takes the meter's key.

```ts
meters: {
  input_tokens: { fold: 'input_tokens', price: usd(0.0000005) },
  output_tokens: { on: 'llm.completion', sum: 'output_tokens', price: usd(0.000002) },
  replies: { fold: 'completions', price: usd(0.05) },
  credits: {
    fold: 'spent_credits',
    credits: 'purchased_credits',        // a sum fold that grants balance
    price: usd(0),                       // prepaid packs, no overage price
  },
}
```

`fold` must name a scalar fold. `credits` must name a `sum` fold. `price` is a
`usd(...)`/`money(...)` value. This is the current `MeterDef` with the
`creditReducer` rename and the inline form expressed as data.

### Entitlements

```ts
entitlements: {
  api_access: { name: 'API access' },
  priority_lane: { name: 'Priority inference lane' },
  seats: { name: 'Seats', limit: 3 },
}
```

Boolean flags as today. `limit` is a proposed extension for seat-style
entitlements (a number the app reads, not usage the server meters); the
ticketing sketch wants it and it costs nothing to reserve.

### Products

```ts
products: {
  starter: {
    name: 'Starter',
    price: { every: 'month', amount: usd(19) },
    meters: {
      input_tokens: { included: 1_000_000, limit: 'soft' },
      output_tokens: { included: 200_000, limit: 'hard', rollover: 'all' },
      replies: 'pay_as_you_go',
    },
    entitlements: ['api_access'],
  },
  scale: {
    name: 'Scale',
    price: { every: 'month', amount: usd(499) },
    meters: { input_tokens: 'unlimited', output_tokens: 'unlimited' },
    entitlements: ['api_access', 'priority_lane'],
  },
  lifetime: {
    name: 'Lifetime',
    price: { once: usd(999) },
    entitlements: ['api_access'],
  },
}
```

- `price` is either `{ every: 'day' | 'week' | 'month' | 'year', count?: n, amount }`
  or `{ once: amount }`. A `once` product cannot carry meters; that is a type
  error, not a runtime throw.
- `meters` keys must be meter keys. A value is `'pay_as_you_go'` (nothing
  included, never denied), `'unlimited'`, or terms
  `{ included, limit?: 'hard' | 'soft', rollover?: number | 'all' }`.
  Defaults match today's `included()`: `limit: 'hard'`, `rollover: 0`.
- `entitlements` is a list of entitlement keys.

### The whole thing, in one file

```ts
import { defineConfig, usd } from '@void/sdk'
import { z } from 'zod'

export const config = defineConfig({
  events: {
    'llm.completion': z.object({
      model: z.string(),
      input_tokens: z.number().int(),
      output_tokens: z.number().int(),
    }),
    'ticket.opened': z.object({ ticket_id: z.string() }),
    'ticket.closed': z.object({
      ticket_id: z.string(),
      resolution: z.enum(['solved', 'unresolved']),
    }),
  },
  folds: {
    resolved: { on: 'ticket.closed', where: { resolution: 'solved' }, count: true },
  },
  meters: {
    input_tokens: { on: 'llm.completion', sum: 'input_tokens', price: usd(0.0000005) },
    output_tokens: { on: 'llm.completion', sum: 'output_tokens', price: usd(0.000002) },
    resolutions: { fold: 'resolved', price: usd(1.5) },
  },
  entitlements: {
    ai_agent: { name: 'AI agent' },
  },
  products: {
    support_pro: {
      name: 'Support Pro',
      price: { every: 'month', amount: usd(49) },
      meters: {
        input_tokens: { included: 2_000_000, limit: 'soft' },
        output_tokens: { included: 500_000, limit: 'soft' },
        resolutions: 'pay_as_you_go',
      },
      entitlements: ['ai_agent'],
    },
  },
})
```

Under forty lines, top to bottom, with zod as the only import beyond
`defineConfig` and money.

## The SDK the definition produces

`defineConfig` returns the validated config plus `connect`:

```ts
const void_ = config.connect({
  apiUrl: process.env.VOID_API_URL!,
  token: process.env.VOID_TOKEN!,
})
```

`connect` is `createVoid(config, options)` under a name that reads as a
method of the definition. The client is `Client<C>` where `C` is the literal
config type, and every namespace is a mapped type over the corresponding
section:

```ts
const actor = void_.as(customerId)

await actor.events('llm.completion').record({
  model: 'gpt-4o', input_tokens: 512, output_tokens: 90,
})                                             // payload typed from the spec
await actor.events('ticket.closed').list({ limit: 50 })

await actor.folds.resolved.total()             // scalar folds: total, usage
await actor.folds.latest_plan.latest()         // record folds: latest

await actor.meters.output_tokens.check({ estimate: 4_000 })
await actor.meters.output_tokens.balance()

await actor.products.support_pro.subscribe()
await actor.entitlements.ai_agent.has()        // boolean, walks the chain
await actor.entitlements.has('ai_agent')       // same, key-typed
const snapshot = await actor.snapshot()
snapshot.meters.output_tokens.remaining
```

The verbs are the existing ones (`record`, `list`, `total`, `usage`,
`latest`, `check`, `balance`, `subscribe`, `snapshot`, identity navigation).
What changes is where their types come from: today from `Extract<M[keyof M], MeterDef>`
over a module, tomorrow from `keyof C['meters']`.

Two conveniences worth adding because the ticketing sketch reached for them:

```ts
await void_.track('ticket.opened', { customer, ticket_id })   // as(customer).events(...).record
await void_.as(customer).can('ai_agent')                       // entitlement or quota gate, one call
```

### Naming: events are addressed by key

Event names carry dots (`llm.completion`), so the client does not expose them
as properties. `events` is a function of the key:

```ts
events<K extends EventKeys<C>>(key: K): EventQuery<Payload<C['events'][K]>>
// Payload<C['events'][K]> is StandardSchemaV1.InferOutput of the zod schema
```

- One name. The key you wrote in the config is the string you pass, which
  removes the export-name/event-name split that motivated this proposal.
- Autocomplete and narrowing work on the literal argument, and a typo is a
  type error at the call site.
- It reads the same as `track('llm.completion', ...)`, which is the form most
  calls will use anyway.

Folds, meters, products and entitlements have plain slugs, so they stay
property access (`meters.output_tokens`). Keeping events as the one
call-style accessor is a deliberate signal that events are named by the
outside world and everything else is named by you.

## Type machinery

The whole design rests on one signature:

```ts
export function defineConfig<const C extends ConfigShape<C>>(config: C): Config<C>
```

`ConfigShape<C>` is a *self-referential constraint*: it describes each section
in terms of the other sections of the same literal. This is the pattern
`satisfies`-style DSLs (drizzle relations, tRPC routers, hono) use.

```ts
type EventKeys<C> = keyof C['events'] & string
type FoldKeys<C> = keyof C['folds'] & string
type MeterKeys<C> = keyof C['meters'] & string

type EventSchema = StandardSchemaV1<unknown, Record<string, Json>>
type Payload<S extends EventSchema> = StandardSchemaV1.InferOutput<S>

type ConfigShape<C> = {
  events: Record<string, EventSchema>
  folds?: { [K in string]: FoldSpec<C> }
  meters: { [K in string]: MeterSpec<C> }
  entitlements?: Record<string, EntitlementSpec>
  products?: { [K in string]: ProductSpec<C> }
}

type FoldSpec<C> =
  | { [E in EventKeys<C>]: EventFold<C['events'][E]> & { on: E } }[EventKeys<C>]
  | DerivedFold<FoldKeys<C>>

type EventFold<S extends EventSchema> =
  & { where?: Matcher<Payload<S>> }
  & (
    | { count: true }
    | { sum: NumericKeys<S> } | { min: NumericKeys<S> } | { max: NumericKeys<S> }
    | { first: true } | { last: true }
  )

type MeterSpec<C> =
  & { price: Money; credits?: SumFoldKeys<C> }
  & ({ fold: ScalarFoldKeys<C> } | FoldSpec<C>)

type ProductSpec<C> =
  | {
      name: string
      price: { every: Interval; count?: number; amount: Money }
      meters?: { [M in MeterKeys<C>]?: 'pay_as_you_go' | 'unlimited' | Terms }
      entitlements?: readonly (keyof C['entitlements'] & string)[]
    }
  | {
      name: string
      price: { once: Money }
      meters?: never
      entitlements?: readonly (keyof C['entitlements'] & string)[]
    }
```

The distributive union in `FoldSpec` is what ties `sum: 'input_tokens'` to the
event named in `on`. It is the one place the types get clever, and it is
contained.

What the compiler catches, with the message a user sees:

| Mistake | Error |
| --- | --- |
| `on: 'llm.completon'` | `Type '"llm.completon"' is not assignable to type '"llm.completion" \| "ticket.opened" \| ...'` |
| `sum: 'model'` on `llm.completion` | `Type '"model"' is not assignable to type '"input_tokens" \| "output_tokens"'` |
| product meters key not a meter | `Object literal may only specify known properties` |
| `{ once }` product with `meters` | `Types of property 'meters' are incompatible` |
| `credits: 'completions'` (a count fold) | `Type '"completions"' is not assignable to type '"purchased_credits"'` |

Runtime validation in `defineConfig` repeats the same checks and adds the ones
types cannot express (slug format, non-negative prices, a `derive` expression
referencing exactly its inputs, no cycles), throwing with the same wording.

## Presets replace plugins

A preset is a function that returns a config fragment with the same shape.
Fragments merge into the top-level config, and their runtime helpers, when
they have any, attach under a namespace of the client.

```ts
import { defineConfig, usd } from '@void/sdk'
import { llmTokens } from '@void/sdk/presets'

const llm = llmTokens({
  models: { 'gpt-4o': { input: usd(2.5e-6), output: usd(1e-5) } },
  other: { input: usd(1e-6), output: usd(4e-6) },
})

export const config = defineConfig({
  ...llm.definition,           // events, folds, meters it needs
  products: {
    pro: {
      name: 'Pro',
      price: { every: 'month', amount: usd(49) },
      meters: { ...llm.included({ 'gpt-4o': 1_000_000 }) },
    },
  },
  use: [llm],                  // runtime: client.llm.track(...), client.llm.check(...)
})
```

Three things make this simpler than the current `PluginDef`:

- The preset's definitions are ordinary keys in the same tree. They show up in
  the dashboard, in `void plan`, and in autocomplete like anything else. A
  preset cannot reach for reserved names because it lives in sections, not on
  the scope.
- Merging is a spread. At the type level `defineConfig` sees the union of
  keys; a collision between a preset key and a user key is a type error
  (`llm.completion` defined twice) rather than a runtime throw.
- `use` is only for runtime verbs and snapshot shaping. A preset without verbs
  is just a function returning data.

`llmTokens` and `credits` port over directly; `metered(model)` from the
ticketing sketch becomes a preset that wraps an AI SDK model and contributes
one event, three folds and three meters.

## Compile target

The compiler turns the config into the same IR the server already accepts
(`version: 5`; `version: 4` plus event schemas):

- `events[]`: name and, new, `schema`: the event's JSON Schema when the
  library adapter can produce one. Zod ships with the SDK; others are
  pluggable.
- `reducers[]`: one per fold and per inline meter fold, `slug` = key.
- `meters[]`: `slug`, `reducer`, `credit_reducer`, `unit_amount`, `currency`.
- `entitlements[]`, `products[]`: unchanged, with `rollover: 'all'` mapped to
  `rollover_cap: null`.

The checksum is over the compiled IR. Since the JSON Schema is part of it,
tightening a validation rule changes the checksum; that is correct, since it
changes what the server accepts, but it is new behaviour and worth stating.
A config rewritten from the old style to the new one with the same keys and
no schemas still deploys as a no-op. That gives a migration
test: compile both, assert equal checksums.

`void plan` gains a better diff for free, because the config is plain data:
it can print "meter `output_tokens`: price 0.000002 → 0.000003" from the
object without walking exports.

## Migration

- `defineConfig` accepts both shapes for one release. `{ schema }` is the old
  form; an object with `events` or `meters` at the top level is the new form.
  The old form logs a deprecation with the generated new-form equivalent.
- A codemod (`void migrate`) evaluates an old config and prints the new object.
  Since the old form's runtime values already carry keys and structure, the
  translation is mechanical; the only judgement call is naming inline
  reducers, which take their meter's key.
- The runtime client keeps every verb. The source-level changes for apps are
  `events.creditsPurchased` → `events('credits.purchased')`, and
  `event<{ amount: number }>('credits.purchased')` →
  `z.object({ amount: z.number() })`. The codemod emits the zod schema from
  the old metadata type where it can read it, and a `z.record(z.json())`
  placeholder where it cannot.

## Security considerations

The config carries no credentials, organization id or server URL; `connect()` receives those at runtime, exactly as `createVoid` does today, so the trust boundary is unchanged. Event schemas are the one new data flow: their JSON Schema is compiled into the deployment payload and, if server-side validation is enabled, used to reject malformed events. They describe shapes only, never values, and are visible to anyone who can already read the deployed definition. Schema libraries run in the merchant's process on the merchant's own payloads; the server only ever sees the JSON Schema and validates with a standard validator, never by executing merchant code. Presets run at config-evaluation time in the merchant's process, like any imported code, and contribute plain data; they gain no access to the runtime client beyond the `use` hook a merchant opts into. Nothing in this proposal changes what the API exposes or stores.

## Open questions

1. **Renames.** Keys are slugs; renaming a meter is a new meter. Do we want
   `previously: 'old_key'` on a definition so deploy migrates identity, or is
   "rename = new generation" the rule we want to keep?
2. **Server-side payload validation.** With JSON Schema in the deployment the
   server can reject malformed events. Do we want that on by default (safer,
   breaking for producers that bypass the SDK) or opt-in per event? Producer
   side, `record()` always validates.
3. **Overrides and invariants.** The ticketing sketch has `overrides` (per
   customer terms) and `invariants` (margin and spend assertions). Both are
   compelling and both are out of scope here; the proposal reserves the
   top-level keys so they can land without reshaping the tree.
4. **Where `where` values come from.** Comparison helpers (`gt`, `not`) are the
   one non-JSON thing in the tree. An alternative is `{ model: { ne: 'x' } }`
   objects, which are plain data and print cleanly. Either is fine; the
   object form is more consistent with the rest of the proposal.
5. **Call-style event access.** `events('llm.completion')` is settled for
   events. Should folds and meters get the same accessor for symmetry
   (`meters('output_tokens')`), or is property access the better default
   where keys are plain slugs?

## Implementation plan

1. `config/types.ts`: `EventSchema`, `Payload`, `ConfigShape`, `Config`, the
   error-message types. Pure types over Standard Schema, testable with
   `expectTypeOf` against zod, valibot and arktype fixtures.
2. `config/define.ts`: new `defineConfig` overload, runtime validation, and
   normalisation into the internal definitions the rest of the SDK already
   uses (`EventDef`, `ReducerDef`, `MeterDef`, `ProductDef`). This keeps
   `compile.ts`, `runtime/*` and the CLI untouched in the first pass.
3. `runtime/client.ts`: `connect` on the returned config; typed namespaces
   keyed by section keys instead of export names.
4. `config/schema-adapters.ts`: the JSON Schema adapter interface with a zod
   implementation; `record()` validation through Standard Schema's `~validate`.
5. `presets/`: port `llmTokens` and `credits`; add `metered`.
6. `cli`: `void migrate`, and a `plan` diff that reads the new object.
7. Docs and the builder example rewritten in the new form; checksum parity
   test against the old form.

Roughly two weeks of focused work for one person, with step 2 being the bulk.
