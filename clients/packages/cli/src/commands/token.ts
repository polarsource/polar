import { Effect, Path, Redacted } from 'effect'
import { Command, Flag } from 'effect/cli'
import type { PolarEnvironment } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { environmentSettings, TokenHandoff } from '@/services/token-handoff'
import { textOnly } from '@/utils/command'
import { noteToStderr } from '@/utils/progress'
import * as ui from '@/utils/ui'

const scope = Flag.String('scope').pipe(
  Flag.withDescription(
    'Scope to preselect on the token page, e.g. products:read. Repeatable.',
  ),
  Flag.atLeast(0),
)

const sdkHints: Record<PolarEnvironment, string | undefined> = {
  production: undefined,
  sandbox: 'Pass server: process.env.POLAR_ENVIRONMENT to your Polar SDK',
  local: 'Pass serverURL: process.env.POLAR_API_URL to your Polar SDK',
}

const announceTokenPage = (page: URL) =>
  noteToStderr(
    [
      ui.blank,
      ui.step('Opening your browser to create an organization access token...'),
      ui.step('If it does not open, visit:'),
      `    ${ui.cyan(page.toString())}`,
      ui.blank,
      ui.step('Waiting for the token...'),
      ui.blank,
    ].join('\n'),
  )

export const token = Command.make('token', { scope }).pipe(
  Command.withDescription(
    'Create an organization access token for your app and print it as KEY=value lines',
  ),
  Command.withExamples([
    {
      command: 'polar auth token >> .env.local',
      description: 'Add the token for the active organization to .env.local',
    },
    {
      command:
        'polar auth token --scope products:read --scope checkouts:write | fly secrets import',
      description:
        'Preselect scopes and pipe the variables into a hosting provider without writing them to disk',
    },
  ]),
  textOnly({
    reason: 'it prints the token as KEY=value lines',
    run: (flags) =>
      Effect.gen(function* () {
        const path = yield* Path.Path
        const { slug, environment } = yield* (yield* Organizations).resolve()
        const created = yield* (yield* TokenHandoff).receive(
          {
            organization: { slug, environment },
            name: path.basename(process.cwd()),
            scopes: flags.scope,
          },
          announceTokenPage,
        )
        const hint = sdkHints[environment]
        if (hint) yield* noteToStderr(ui.step(hint))
        return [
          ['POLAR_ACCESS_TOKEN', Redacted.value(created)] as const,
          ...(yield* environmentSettings(environment)),
        ]
      }),
    render: (variables: ReadonlyArray<readonly [string, string]>) =>
      variables.map(([name, value]) => `${name}=${value}`),
  }),
)
