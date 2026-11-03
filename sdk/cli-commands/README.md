# Polar CLI commands prototype

Private package generated from Polar's `2026-10` and `2027-01` OpenAPI snapshots.
It is not published to npm. The CLI consumes it through a local `file:` dependency,
imports TypeScript directly, and bundles it.

The package deliberately is not a member of `clients/pnpm-workspace.yaml`: Turbo
rejects workspace packages outside the `clients/` root. A `file:` dependency keeps
the generated package under `sdk/` without moving or breaking that workspace.

## Start here

- `src/customers/list.ts`: generated Effect flags, query assembly, and SDK call.
- `src/customers/create.ts`: generated body flags, including customer-type variants.
- `src/index.ts`: generated command tree and exports.
- `src/runtime.ts`: Effect service contract provided by the consuming CLI.
- `clients/packages/cli/src/api-runtime.ts` (repository root): CLI implementation.

```ts
import { commands } from '@polar-sh/cli-commands'

const main = Command.make('polar').pipe(
  Command.withSubcommands([auth, listen, update, ...commands]),
)
```

## API versions

Commands come from Current. Operations that exist only in Next are added too,
call the Next SDK, and are labelled `(preview, API 2027-01)` since Next can still
change. At each rotation, update the specs in `pnpm generate` and the version map
in `clients/packages/cli/src/services/polar.ts`.

The generator lives in `sdk/generator/cli_commands/`. Change the emitter or its
runtime/input templates, not generated files. The package never imports the CLI.

## Generate and try it

From `clients/`, install dependencies with `pnpm install`.
From `sdk/generator/`, run `just openapi` to generate the versioned specs from
the configured backend environment.
Then, from `clients/packages/cli/` (generation also refreshes the installed local package):

```bash
pnpm generate
bun src/cli.ts customers --help
bun src/cli.ts customers list --email=alice@example.com --limit=20
bun src/cli.ts customers list --active=false --org=<organization-id>
bun src/cli.ts customers create --email=alice@example.com --org=<organization-id>
bun src/cli.ts customers update <id> -d '{"name":null,"metadata":{"source":"cli"}}'
bun src/cli.ts customers get_external <external-id>
bun src/cli.ts customers delete <id> --confirm
```

Requests use the organization selected with `polar auth org`, including its
sandbox or production environment and saved OAuth credentials. Authenticated resource
commands have no environment flags. These are real API calls, including mutations: select
a sandbox organization when experimenting.

`customer_seats get_claim_info` and `customer_seats claim_seat` use only the
invitation token, without a login or selected organization. They default to
production; pass `--environment=sandbox` for sandbox invitations.

`orders receipt <id>` prints a JSON status and message when receipt generation
is still in progress (`202`). Run the command again to retrieve the download URL.

With `POLAR_ACCESS_TOKEN`, the CLI uses the token's sole accessible organization
and `POLAR_ENVIRONMENT` (production by default), rather than the saved selection.
The token must have a single accessible organization.

Also available: `get`, `get_state`, `get_state_external`, `update_external`,
`delete_external`, `list_payment_methods`, and `list_payment_methods_external`.
Authenticated requests send the organization's ID in the `Polar-Organization`
header, so the API only returns and changes that organization's data and defaults
organization inputs to it. The CLI does not fill in organization inputs: `--org`
aliases the `organization_id` input, and explicit flags and `--data` values,
including `null`, are sent as given. An `--org` value selects that organization,
with its environment and credentials, for the request without changing the saved
selection. Repeated `--org` values must share an environment; they are sent as
filters and the header is omitted, since it scopes a request to one organization.
Commands without an organization input use the selected environment and the
resource ID you supply.

`--data` / `-d` accepts a single JSON object. It supplies query parameters on
query-bearing commands and body fields on create/update. Explicit flags replace
matching top-level JSON keys with a shallow merge. Complex fields also accept JSON
flags, e.g. `--billing-address='{"country":"US"}'`. Omitted flags are not merged,
so `false`, empty strings, and explicit JSON `null` are preserved.

Nullable string flags accept `null` to clear a value, e.g. `--discount-id=null`.
Use `--data` to send the literal string `"null"`. `--trial-end=now` and unquoted
ISO timestamps are accepted directly.

Required union discriminators must be supplied as a flag or through `--data`.
For example, `custom_fields update <id> --name="New name" --type=text` requires
the field's existing type, even when only its name changes.

## Destructive confirmation

A command requires confirmation when its operation has `destructive` in
`x-tool-annotations`. The server sets it with the helpers in
`server/polar/openapi.py`, and the MCP server reads the same annotation for its
`destructiveHint`.

`DELETE` operations are always destructive. Other operations can be destructive
whatever their input with `openapi_extra=destructive()`, as license-key rotation
does.

To require confirmation only when a top-level input property matches a scalar,
annotate it with `destructive_when_equals`. For example, `ProductUpdate` uses:

```python
is_archived: bool | None = Field(
    default=None,
    json_schema_extra=destructive_when_equals(True),
)
```

For multiple matching values, use `destructive_when_one_of("revoked", "disabled")`.
Both emit `x-tool-destructive-when` with either `equals` or a non-empty `one_of`
list, and make the server add `destructive` to the operation. Query parameter
schemas can use the same annotation. The generator checks every comparison value
against the field schema and emits `requiresConfirmation` from the merged request
input. Any matching annotated field triggers confirmation. A destructive operation
without annotated fields always requires it. Nested properties and structured
comparison values are not supported.

```bash
polar products update <id> --is-archived=true
polar products update <id> -d '{"is_archived":true}'
polar products update <id> --is-archived=true --confirm
polar products update <id> --is-archived=false
```

The first two commands preview the product and require the exact answer `yes`.
`--confirm` / `-c` skips preview and prompt and is required without an interactive
terminal. False, null, and omitted archive values do not prompt. Explicit flags
override `--data` before the condition is evaluated.

Only annotated inputs receive additional strict Effect Schema validation, so JSON
strings or numbers cannot bypass a boolean condition through backend coercion.
Other API payload validation remains server-side. Preview lookup, its one-second
timeout, 404 handling, and fixed loading rows are shared with DELETE confirmation.
The GET's `x-polar-cli-preview` metadata selects the displayed record fields.
Only updates and deletions use a same-path GET preview; creation commands prompt
without fetching a collection as though it were an existing record.

Protected inputs include:

- Products and meters: `--is-archived=true`.
- Subscriptions: `--revoke=true`, `--cancel-at-period-end=true`, or `--pause-at-period-end=true`.
- Webhook endpoints: `--enabled=false`.
- License keys: `--status=revoked` or `--status=disabled`.
- License-key rotation always requires confirmation or `--confirm`.
- Refund creation: `--revoke-benefits=true`. Other refunds are not gated by this rule.

## Prototype boundaries

- CLI-tagged, non-private operations; no composite workflows.
- Validates flag primitives/enums and JSON syntax, not complete API schemas.
  `mergeInput` contains the intentional type assertion at that boundary. Required
  fields other than union discriminators, union combinations, and nested values
  are validated by the server.
- Flat and repeatable flags plus JSON; dotted/bracket flag aliases are deferred.
- Uses the current CLI API wrapper, including its existing generic error messages.
- DELETE, annotated operations, and matching annotated inputs require interactive confirmation or `--confirm`.
- No dry-run, response-header output, automatic pagination, or custom help renderer.
- Generation is explicit (`pnpm generate`), not yet enforced in every release path.
  CI path filters and generated-package cache invalidation still need hardening.
- Uses SDK `1.0.3-alpha.4`. `pnpm generate` and `just generate-cli` pin the `2026-10` and `2027-01` specs.

## Checks and builds

From `clients/packages/cli/`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:binary
```

The CLI type-checks the imported command sources and runs their integration tests.
To lint the emitted source itself, from `clients/` run
`pnpm exec oxlint --type-aware --deny-warnings "$(cd ../sdk/cli-commands && pwd)/src"`.

Generator checks live in `sdk/generator/`: `just lint`, `just test`, and
`just generate-cli`. Generated source is committed so ordinary CLI builds do not
need Python. After running the generator directly, refresh the local dependency
with `pnpm install --filter @polar-sh/cli --ignore-scripts --frozen-lockfile` in `clients/`.
Bun embeds the command package in the standalone binary; the JS
build explicitly bundles it rather than leaving an unpublished package import.
