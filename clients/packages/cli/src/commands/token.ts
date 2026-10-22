import { Effect, Path, Redacted } from 'effect'
import { Command, Flag } from 'effect/cli'
import { Organizations } from '@/services/organizations'
import { sdkHint, TokenHandoff } from '@/services/token-handoff'
import { textOnly } from '@/utils/command'
import { noteToStderr } from '@/utils/progress'
import * as ui from '@/utils/ui'

const scope = Flag.String('scope').pipe(
  Flag.withDescription(
    'Scope to preselect on the token page, e.g. products:read. Repeatable',
  ),
  Flag.atLeast(0),
)

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
    'Create an organization access token for your app and print it',
  ),
  Command.withExamples([
    {
      command: 'echo "POLAR_ACCESS_TOKEN=$(polar auth token)" >> .env.local',
      description: 'Add a token for the active organization to .env.local',
    },
    {
      command:
        'polar auth token --scope products:read --scope checkouts:write | gh secret set POLAR_ACCESS_TOKEN',
      description:
        'Preselect scopes and store the token as a GitHub Actions secret without writing it to disk',
    },
  ]),
  textOnly({
    reason: 'it prints only the token',
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
        const hint = yield* sdkHint(environment)
        if (hint) yield* noteToStderr(ui.step(hint))
        return Redacted.value(created)
      }),
    render: (created: string) => [created],
  }),
)
