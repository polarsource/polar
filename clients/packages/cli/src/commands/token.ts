import { Effect, FileSystem, Option, Path, Redacted, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { AuthError, PolarEnvironment } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { TokenHandoff } from '@/services/token-handoff'
import { output } from '@/utils/command'
import { upsertEnv } from '@/utils/env-file'
import { note } from '@/utils/progress'
import * as ui from '@/utils/ui'

const scope = Flag.String('scope').pipe(
  Flag.withDescription(
    'Scope to preselect on the token page, e.g. products:read. Repeatable.',
  ),
  Flag.atLeast(0),
)

const name = Flag.String('name').pipe(
  Flag.optional,
  Flag.withDescription('Token name. Defaults to the current directory name'),
)

const envFile = Flag.String('env-file').pipe(
  Flag.withDefault('.env'),
  Flag.withDescription('File to write the token to'),
)

const envVar = Flag.String('env-var').pipe(
  Flag.withDefault('POLAR_ACCESS_TOKEN'),
  Flag.withDescription('Variable name to store the token under'),
)

const Target = Schema.Struct({
  slug: Schema.String,
  environment: PolarEnvironment,
})

const Created = Schema.Struct({
  organization: Target,
  envFile: Schema.String,
  envVar: Schema.String,
  replaced: Schema.Boolean,
})

const announceTokenPage = (page: URL) =>
  note(
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

const writeToken = (
  file: string,
  variable: string,
  token: Redacted.Redacted<string>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const current = yield* fs
      .readFileString(file)
      .pipe(
        Effect.catch((error) =>
          error.reason._tag === 'NotFound'
            ? Effect.succeed('')
            : Effect.fail(error),
        ),
      )
    const { content, replaced } = upsertEnv(
      current,
      variable,
      Redacted.value(token),
    )
    yield* fs.writeFileString(file, content)
    return replaced
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
  name,
  envFile,
  envVar,
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
  ]),
  output({
    result: Created,
    run: (flags) =>
      Effect.gen(function* () {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(flags.envVar)) {
          return yield* new AuthError({
            message: `${flags.envVar} is not a valid environment variable name.`,
          })
        }
        const path = yield* Path.Path
        const { slug, environment } = yield* (yield* Organizations).resolve()
        const organization = { slug, environment }
        const file = path.resolve(flags.envFile)
        const created = yield* (yield* TokenHandoff).receive(
          {
            organization,
            name: Option.getOrElse(flags.name, () =>
              path.basename(process.cwd()),
            ),
            scopes: flags.scope,
          },
          announceTokenPage,
        )
        const replaced = yield* writeToken(file, flags.envVar, created)
        return { organization, envFile: file, envVar: flags.envVar, replaced }
      }),
    render: ({
      organization,
      envFile,
      envVar,
      replaced,
    }: typeof Created.Type) => [
      ui.success(
        `Created an access token for ${ui.bold(organization.slug)} ${ui.dim(organization.environment)}`,
      ),
      ui.step(`${replaced ? 'Updated' : 'Added'} ${envVar} in ${envFile}`),
      ...(organization.environment === 'sandbox'
        ? [ui.step("Point your Polar SDK at the sandbox: server: 'sandbox'")]
        : []),
      ui.blank,
    ],
  }),
)
