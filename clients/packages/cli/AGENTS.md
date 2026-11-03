# Polar CLI

When writing effect code look for best practices and established patterns in:

- Effect source code: `~/.local/share/effect-solutions/effect`
- Opencode codebase: `~/.local/share/effect-solutions/opencode`

## Layout

```
src/
├── commands/   one file per command (or group); nothing else lives here
├── services/   talk to the API or the system; return data and typed errors, never print
├── schemas/    Effect schemas, result types and error classes shared by every layer
└── utils/      rendering and helpers; may use types from services, never call them
```

The `polar-cli/*` rules in `lint/rules/` enforce these boundaries. Run
`pnpm lint` after adding a file; the message tells you where it belongs.

## Running it locally

Run the local CLI from source as `dev polar <command>` (the `dev` CLI runs
`src/` in your current directory, so `dev polar config plan` from
`clients/apps/demo-app` picks up its `polar.config.ts`). Never test against a
compiled `polar` binary with saved sessions: macOS treats the fresh binary as
untrusted and prompts for the keychain password on every read. When a compiled
artifact must be tested, limit it to `--version` and `--help`, or set
`POLAR_ACCESS_TOKEN` to bypass the keyring.

## Adding a command

Build it with `command()` from `@/utils/command`. `run` computes a result,
`render` turns it into lines; the helper adds `--json`, prints either form,
emits a JSON error envelope on failure and sets the exit code.

```ts
import { Effect } from 'effect'
import { Argument } from 'effect/cli'
import { command } from '@/utils/command'
import { org } from '@/utils/flags'
import * as ui from '@/utils/ui'

export const show = command({
  name: 'show',
  description: 'Show a meter',
  flags: { id: Argument.String('id'), org },
  run: ({ id, org }) =>
    Effect.gen(function* () {
      /* call a service, return data */
    }),
  render: (meter) => [ui.keyValue([['Name', meter.name]])],
  json: (meter) => ({ id: meter.id, name: meter.name }), // optional: curate the JSON shape
  failed: (meter) =>
    meter.archived ? new MeterError({ message: '…' }) : undefined,
  examples: [{ command: 'polar meters show <id>', description: '…' }],
})
```

Register it in the group's `index.ts` (`group(name, description)` +
`Command.withSubcommands`) and in `src/program.ts`. Preview-only commands go in
the `previews` list there and only appear with `POLAR_PREVIEW=1`.

Rules of thumb:

- `run` never prints. In-flight status goes through `withProgress`/`note` from
  `@/utils/progress`, which stay silent under `--json`.
- Commands that never return (`listen`) use `streaming()` instead and emit
  through its `Emit`: human text, or one JSON object per line under `--json`.
- Commands where JSON makes no sense (e.g. one that opens a browser) use
  `textOnly()` instead; it refuses `--json` and explains why.
- `--json` is an output format. A flag that changes behaviour gets its own
  name (`--dry-run`, `--list`).
- Test with `runCli(command, ['…', '--json'])` from `@/utils/test-utils/cli`
  and `JSON.parse(cli.output())`.
- Run `pnpm docs:generate` afterwards; the reference under `docs/` is
  generated from the command tree and CI checks it.
