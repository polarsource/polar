import { Effect, Option, Path, Redacted } from 'effect'
import { Command, Flag } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { sdkHint, TokenHandoff } from '@/services/token-handoff'
import { textOnly } from '@/utils/command'
import { org } from '@/utils/flags'
import { noteToStderr } from '@/utils/progress'
import * as ui from '@/utils/ui'

const scope = Flag.String('scope').pipe(
  Flag.withDescription(
    'Scope to preselect on the token page, e.g. products:read. Repeatable',
  ),
  Flag.atLeast(0),
)

const announceTokenPage =
  ({ slug, environment }: Pick<ActiveOrganization, 'slug' | 'environment'>) =>
  (page: URL) =>
    noteToStderr(
      [
        ui.blank,
        ui.step(
          `Opening your browser to create an access token for ${slug} on ${environment}...`,
        ),
        ui.step('If it does not open, visit:'),
        `    ${ui.cyan(page.toString())}`,
        ui.blank,
        ui.step('Waiting for you to approve it in the browser...'),
        ui.blank,
      ].join('\n'),
    )

export const token = Command.make('token', { scope, org }).pipe(
  Command.withDescription(
    'Give your app its own organization access token: a human approves it in the browser, with any --scope preselected, and the CLI prints it',
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
    {
      command:
        'POLAR_ACCESS_TOKEN=<your access token> polar auth token --org <org id> --scope events:write',
      description:
        'As an agent without a saved session, use your own access token; a human still approves the app token',
    },
    {
      command: 'polar auth token --org acme --scope events:write',
      description: 'Create a token for a specific organization',
    },
  ]),
  textOnly({
    reason: 'it prints only the token',
    run: (flags) =>
      Effect.gen(function* () {
        const path = yield* Path.Path
        const { slug, environment } = yield* (yield* Organizations).resolve(
          Option.getOrUndefined(flags.org),
        )
        const organization = { slug, environment }
        const created = yield* (yield* TokenHandoff).receive(
          {
            organization,
            name: path.basename(process.cwd()),
            scopes: flags.scope,
          },
          announceTokenPage(organization),
        )
        yield* noteToStderr(
          [
            ui.success(`Created an access token for ${slug} on ${environment}`),
            ...(yield* sdkHint(environment)).map(ui.step),
          ].join('\n'),
        )
        return Redacted.value(created)
      }),
    render: (created: string) => [created],
  }),
)
