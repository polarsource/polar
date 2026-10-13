import { Effect, FileSystem, Path, Redacted, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { AuthError, PolarEnvironment } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import {
  ENVIRONMENT_VARS,
  environmentSettings,
  TokenHandoff,
} from '@/services/token-handoff'
import { output } from '@/utils/command'
import { hasEnv, upsertEnv } from '@/utils/env-file'
import { note, noteToStderr } from '@/utils/progress'
import * as ui from '@/utils/ui'

const scope = Flag.String('scope').pipe(
  Flag.withDescription(
    'Scope to preselect on the token page, e.g. products:read. Repeatable.',
  ),
  Flag.atLeast(0),
)

const envFile = Flag.String('env-file').pipe(
  Flag.withDefault('.env'),
  Flag.withDescription('File to write the token to'),
)

const stdout = Flag.Boolean('stdout').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Print the variables as KEY=value lines instead of writing --env-file, to pipe into another command',
  ),
)

const Target = Schema.Struct({
  slug: Schema.String,
  environment: PolarEnvironment,
})

const Written = Schema.Struct({
  name: Schema.String,
  replaced: Schema.Boolean,
})

const Saved = Schema.Struct({
  destination: Schema.Literal('file'),
  organization: Target,
  envFile: Schema.String,
  written: Schema.Array(Written),
  stale: Schema.Array(Schema.String),
})

const Printed = Schema.Struct({
  destination: Schema.Literal('stdout'),
  organization: Target,
  variables: Schema.Array(
    Schema.Struct({ name: Schema.String, value: Schema.String }),
  ),
})

const Created = Schema.Union([Saved, Printed])
type Created = typeof Created.Type

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

const writeEnv = (
  file: string,
  settings: ReadonlyArray<readonly [string, string]>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    let content = yield* fs
      .readFileString(file)
      .pipe(
        Effect.catch((error) =>
          error.reason._tag === 'NotFound'
            ? Effect.succeed('')
            : Effect.fail(error),
        ),
      )
    const written: Array<typeof Written.Type> = []
    for (const [name, value] of settings) {
      const result = upsertEnv(content, name, value)
      content = result.content
      written.push({ name, replaced: result.replaced })
    }
    yield* fs.writeFileString(file, content, { mode: 0o600 })
    const stale = ENVIRONMENT_VARS.filter(
      (name) =>
        hasEnv(content, name) && !settings.some(([key]) => key === name),
    )
    return { written, stale }
  }).pipe(
    Effect.mapError(
      () =>
        new AuthError({
          message: `Unable to write the token to ${file}. Check its permissions. The token was created; revoke it from the dashboard if you can't recover it.`,
        }),
    ),
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
        'Create a token for the active organization and add it to .env',
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
  output({
    result: Created,
    run: (flags) =>
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
          announceTokenPage(flags.stdout ? noteToStderr : note),
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
        const file = path.resolve(flags.envFile)
        const { written, stale } = yield* writeEnv(file, settings)
        return {
          destination: 'file',
          organization,
          envFile: file,
          written,
          stale,
        } satisfies Created
      }),
    render: (created: Created) => {
      if (created.destination === 'stdout') {
        return created.variables.map(({ name, value }) => `${name}=${value}`)
      }
      const { organization, envFile, written, stale } = created
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
        ...(hint ? [ui.step(hint)] : []),
        ui.blank,
      ]
    },
  }),
)
