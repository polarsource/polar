# Polar CLI commands prototype

Private package generated from Polar's `2026-04` OpenAPI snapshot.
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
- `clients/packages/cli/src/services/api-runtime.ts` (repository root): CLI implementation.

```ts
import { commands } from '@polar-sh/cli-commands'

const main = Command.make('polar').pipe(
  Command.withSubcommands([auth, listen, update, ...commands]),
)
```

The generator lives in `sdk/generator/cli_commands/`. Change the emitter or its
runtime/input templates, not generated files. The package never imports the CLI.

## Generate and try it

From `clients/`, install dependencies with `pnpm install`.
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

Requests default to sandbox. Add `--production` for production. Existing saved
OAuth credentials or `POLAR_ACCESS_TOKEN` are reused. These are real API calls,
including mutations: use sandbox when experimenting.

Also available: `get`, `get_state`, `get_state_external`, `update_external`,
`delete_external`, `list_payment_methods`, and `list_payment_methods_external`.
`--org` aliases the operation's organization input; repeat it on `list` to filter
multiple organizations. It does not automatically use the saved active organization.

`--data` / `-d` accepts a single JSON object. It supplies query parameters on
query-bearing commands and body fields on create/update. Explicit flags replace
matching top-level JSON keys with a shallow merge. Complex fields also accept JSON
flags, e.g. `--billing-address='{"country":"US"}'`. Omitted flags are not merged,
so `false`, empty strings, and explicit JSON `null` are preserved.

## Prototype boundaries

- Twelve top-level customer operations only; no exports, customer members, private
  customer analytics, other resources, or composite workflows.
- Validates flag primitives/enums and JSON syntax, not complete API schemas.
  `mergeInput` contains the intentional type assertion at that boundary. Required
  fields, union combinations, and nested values are validated by the server.
- Flat and repeatable flags plus JSON; dotted/bracket flag aliases are deferred.
- Uses the current CLI API wrapper, including its existing generic error messages.
- DELETE requires `--confirm`; interactive confirmations are deferred.
- No dry-run, response-header output, automatic pagination, or custom help renderer.
- Generation is explicit (`pnpm generate`), not yet enforced in every release path.
  CI path filters and generated-package cache invalidation still need hardening.
- Uses the pinned SDK version. The generator only accepts the matching `2026-04` spec.

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
with `pnpm install --filter polar-cli --ignore-scripts --frozen-lockfile` in `clients/`.
Bun embeds the command package in the standalone binary; the JS
build explicitly bundles it rather than leaving an unpublished package import.
