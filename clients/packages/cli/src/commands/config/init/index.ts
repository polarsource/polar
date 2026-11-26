import { Effect, FileSystem, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import {
  detectAgents,
  detectFormat,
  projectDirectory,
} from '@/commands/config/init/detect'
import { installPackage } from '@/commands/config/init/install'
import { resolveOrganization } from '@/commands/config/init/organization'
import { nextSteps, renderInit, RERUN } from '@/commands/config/init/report'
import {
  BillingConfigError,
  FORMATS,
  InitOutput,
  type InitRequired,
  type InitWritten,
} from '@/schemas/BillingConfig'
import { AgentSetup } from '@/services/agent-setup/service'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { nameResources, parseExternalIds } from '@/utils/billing-config/name'
import { banner } from '@/utils/logo'
import { interactive } from '@/utils/prompt'
import { target } from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import {
  confirm as confirmFlag,
  local,
  org,
  production,
  sandbox,
} from '@/utils/flags'
import { Output } from '@/utils/output'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Where to write the config. Defaults to polar.config.ts at the root of a JavaScript or TypeScript project, polar.config.json otherwise',
  ),
  Argument.optional,
)

const format = Flag.Literals('format', FORMATS).pipe(
  Flag.optional,
  Flag.withDescription(
    'Write TypeScript (ts) or JSON (json). Detected from your project when omitted: ts with a package.json. In a terminal you confirm it, or choose when there is none. Outside a terminal it writes json when there is none',
  ),
)

const skipInstall = Flag.Boolean('skip-install').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Do not install the package a TypeScript config imports, @polar-sh/polar',
  ),
)

const acceptSuggestions = confirmFlag.pipe(
  Flag.withDescription(
    'Use the suggested external IDs for meters, benefits and products that have none, without asking',
  ),
)

const externalIds = Flag.atLeast(
  Flag.String('external-id').pipe(
    Flag.withDescription(
      'Give the resource with this ID this external ID, as <id>=<external ID>. Repeat it for each resource. Without a terminal, every resource without an external ID needs one, unless you pass --confirm',
    ),
  ),
  0,
)

export const init = Command.make('init', {
  file,
  org,
  sandbox,
  production,
  local,
  format,
  skipInstall,
  confirm: acceptSuggestions,
  externalIds,
}).pipe(
  Command.withDescription(
    "Create a billing config file from your organization's meters, benefits and products, and show what to do next",
  ),
  Command.withExamples([
    {
      command: 'polar config init',
      description:
        'Write a config for the active organization at the root of your project',
    },
    {
      command: 'polar config init --sandbox',
      description:
        'Set up your sandbox organization, logging in first if needed',
    },
    {
      command: 'polar config init --org acme --format json',
      description: 'Write a JSON config for another organization',
    },
    {
      command: 'polar config init --json --confirm',
      description:
        'Use the suggested external IDs for existing resources that have none, for scripts and agents',
    },
    {
      command: 'polar config init --json --external-id <id>=pro',
      description:
        'Choose the external ID of an existing resource; init --json lists the IDs that need one',
    },
    {
      command: 'polar config init billing/polar.config.ts --json',
      description:
        'Write to a specific path and print the result as JSON, for scripts and agents',
    },
  ]),
  output({
    result: InitOutput,
    run: (
      {
        file,
        org,
        sandbox,
        production,
        local,
        format,
        skipInstall,
        confirm,
        externalIds,
      },
      { say },
    ) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const fs = yield* FileSystem.FileSystem
        const { json } = yield* Output
        const setup = yield* AgentSetup
        const caller = setup.callingAgent?.name
        const prompt = !json && caller === undefined && (yield* interactive)
        const given = yield* parseExternalIds(externalIds)
        yield* say([
          ui.blank,
          ...banner([
            ui.bold('polar config init'),
            ui.dim('Set up a billing config for your organization'),
          ]),
          ui.blank,
        ])
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Resolving organization')
            const organization = yield* resolveOrganization(
              { sandbox, production, local },
              Option.getOrUndefined(org),
              prompt,
            )
            yield* progress.finish(target(organization))
            const path = Option.getOrUndefined(file)
            const directory =
              path === undefined ? yield* projectDirectory(fs) : process.cwd()
            const chosen =
              Option.getOrUndefined(format) ??
              (path === undefined
                ? yield* detectFormat(fs, directory, prompt, progress)
                : undefined)
            yield* progress.start('Reading your catalog')
            const outcome = yield* billing
              .init(
                organization,
                {
                  directory,
                  file: path,
                  format: chosen,
                },
                nameResources({ prompt, confirm, given }, progress, say),
              )
              .pipe(
                Effect.map((prepared) => ({ prepared })),
                Effect.catchTag('ExternalIdsRequired', ({ proposed }) =>
                  Effect.succeed({ proposed }),
                ),
              )
            if ('proposed' in outcome) {
              return {
                status: 'external_ids_required',
                organization,
                external_ids: outcome.proposed,
                next: RERUN,
              } satisfies InitRequired
            }
            const { prepared } = outcome
            yield* progress.finish(prepared.file)
            const install = yield* installPackage(
              billing.install,
              prepared.install,
              prepared.installDirectory ?? directory,
              prompt,
              skipInstall,
              progress,
              say,
            )
            const selected = yield* (yield* Organizations).selected.pipe(
              Effect.orElseSucceed(() => undefined),
            )
            const active =
              selected?.id === organization.id &&
              selected.environment === organization.environment
            yield* progress.start('Detecting who is running this')
            const agents =
              caller === undefined ? yield* detectAgents(setup) : undefined
            yield* progress.finish(
              caller === undefined ? 'A human' : `An agent, ${caller}`,
            )
            const result = {
              file: prepared.file,
              format: prepared.format,
              imported: prepared.imported,
              keyed: prepared.keyed,
              skipped: prepared.skipped,
              already_enabled: prepared.already_enabled,
              ...(install ? { install } : {}),
              ...(active ? {} : { org: organization.id }),
              ...(caller ? { caller } : {}),
              ...(agents ? { agents } : {}),
              organization,
            }
            return {
              status: 'written',
              ...result,
              next: nextSteps(result),
            } satisfies InitWritten
          }),
        )
      }),
    render: renderInit,
    failed: (result) =>
      result.status === 'external_ids_required'
        ? new BillingConfigError({
            message: 'Nothing was written: some resources need an external ID',
            hint: 'Pass --confirm to use the suggestions, or --external-id <id>=<external ID> for each.',
          })
        : undefined,
  }),
)
