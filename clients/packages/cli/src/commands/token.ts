import { Effect, Option, Path, Redacted } from 'effect'
import { Command, Flag } from 'effect/cli'
import type { PolarEnvironment } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { defaultEnvFile, isExposedToGit, writeEnv } from '@/services/env-file'
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

const envFile = Flag.String('env-file').pipe(
  Flag.optional,
  Flag.withDescription(
    'File to write the token to. Defaults to .env.local if it exists, otherwise .env',
  ),
)

const stdout = Flag.Boolean('stdout').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Print the variables as KEY=value lines instead of writing --env-file, to pipe into another command',
  ),
)

interface Target {
  readonly slug: string
  readonly environment: PolarEnvironment
}

type Created =
  | {
      readonly destination: 'file'
      readonly organization: Target
      readonly envFile: string
      readonly written: ReadonlyArray<{ name: string; replaced: boolean }>
      readonly stale: ReadonlyArray<string>
      readonly exposedToGit: boolean
    }
  | {
      readonly destination: 'stdout'
      readonly organization: Target
      readonly variables: ReadonlyArray<{ name: string; value: string }>
    }

const sdkHints: Record<PolarEnvironment, string | undefined> = {
  production: undefined,
  sandbox: 'Pass server: process.env.POLAR_ENVIRONMENT to your Polar SDK',
  local: 'Pass serverURL: process.env.POLAR_API_URL to your Polar SDK',
}

const announceTokenPage =
  (print: (text: string) => Effect.Effect<void>) => (page: URL) =>
    print(
      [
        ui.blank,
        ui.step(
          'Opening your browser to create an organization access token...',
        ),
        ui.step('If it does not open, visit:'),
        `    ${ui.cyan(page.toString())}`,
        ui.blank,
        ui.step('Waiting for the token...'),
        ui.blank,
      ].join('\n'),
    )

export const token = Command.make('token', {
  scope,
  envFile,
  stdout,
}).pipe(
  Command.withDescription(
    'Create an organization access token for your app and save it to an env file',
  ),
  Command.withExamples([
    {
      command: 'polar auth token',
      description:
        'Create a token for the active organization and add it to .env.local or .env',
    },
    {
      command:
        'polar auth token --scope products:read --scope checkouts:write --env-file .env.local',
      description: 'Preselect scopes and write to .env.local',
    },
    {
      command: 'polar auth token --stdout | fly secrets import',
      description:
        'Pipe the variables into a hosting provider without writing them to disk',
    },
  ]),
  textOnly({
    reason: 'the token goes into your env file, or with --stdout into a pipe',
    run: (flags, { say }) =>
      Effect.gen(function* () {
        const path = yield* Path.Path
        const { slug, environment } = yield* (yield* Organizations).resolve()
        const organization = { slug, environment }
        const created = yield* (yield* TokenHandoff).receive(
          {
            organization,
            name: path.basename(process.cwd()),
            scopes: flags.scope,
          },
          announceTokenPage(
            flags.stdout ? noteToStderr : (text) => say([text]),
          ),
        )
        const settings: ReadonlyArray<readonly [string, string]> = [
          ['POLAR_ACCESS_TOKEN', Redacted.value(created)],
          ...(yield* environmentSettings(environment)),
        ]
        if (flags.stdout) {
          return {
            destination: 'stdout',
            organization,
            variables: settings.map(([name, value]) => ({ name, value })),
          } satisfies Created
        }
        const file = Option.isSome(flags.envFile)
          ? path.resolve(flags.envFile.value)
          : yield* defaultEnvFile
        const { written, stale } = yield* writeEnv(file, settings)
        return {
          destination: 'file',
          organization,
          envFile: file,
          written,
          stale,
          exposedToGit: yield* isExposedToGit(file),
        } satisfies Created
      }),
    render: (created: Created) => {
      if (created.destination === 'stdout') {
        return created.variables.map(({ name, value }) => `${name}=${value}`)
      }
      const { organization, envFile, written, stale, exposedToGit } = created
      const hint = sdkHints[organization.environment]
      return [
        ui.success(
          `Created an access token for ${ui.bold(organization.slug)} ${ui.dim(organization.environment)}`,
        ),
        ...written.map(({ name, replaced }) =>
          ui.step(`${replaced ? 'Updated' : 'Added'} ${name} in ${envFile}`),
        ),
        ...stale.map((name) =>
          ui.warning(
            `${name} in ${envFile} doesn't match this ${organization.environment} token. Remove it.`,
          ),
        ),
        ...(exposedToGit
          ? [
              ui.warning(
                `${envFile} is not ignored by git. Add it to .gitignore before you commit.`,
              ),
            ]
          : []),
        ...(hint ? [ui.step(hint)] : []),
        ui.blank,
      ]
    },
  }),
)
