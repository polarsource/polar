import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  PullOutput,
  type PullResponse,
  type SaveStatus,
  type SkippedMeter,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Path to write the billing config to. Defaults to the existing config file in the current directory, or polar.config.json',
  ),
  Argument.optional,
)

const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Overwrite the file if it has different content'),
)

const REASONS: Record<string, string> = {
  missing_external_id: 'no external ID',
  archived: 'archived',
  invalid: 'not a valid config entry',
}

interface Pulled {
  organization: ActiveOrganization
  file: string
  status: SaveStatus
  pulled: PullResponse
}

const formatSkipped = (skipped: ReadonlyArray<SkippedMeter>) => [
  ui.blank,
  ui.warning(`Skipped ${plural(skipped.length, 'meter')}:`),
  ...skipped.map(
    (meter) =>
      `${ui.INDENT}${ui.INDENT}${meter.name} ${ui.dim(`(${meter.id})`)}: ${REASONS[meter.reason] ?? meter.reason}`,
  ),
  ...(skipped.some((meter) => meter.reason === 'missing_external_id')
    ? [
        ui.step(
          'Set an external ID on meters you want to manage in config, then pull again.',
        ),
      ]
    : []),
]

const render = ({ organization, file, status, pulled }: Pulled) => {
  const from = `${organization.name} (${organization.environment})`
  return [
    ui.blank,
    status === 'written'
      ? ui.success(
          `Pulled ${plural(pulled.config.meters.length, 'meter')} from ${from} into ${file}`,
        )
      : ui.success(`${file} is up to date with ${from}`),
    ...(pulled.skipped.length > 0 ? formatSkipped(pulled.skipped) : []),
  ]
}

export const pull = Command.make('pull', { file, org, force }).pipe(
  Command.withDescription(
    "Write your organization's current billing config to a file",
  ),
  output({
    result: PullOutput,
    run: ({ file, org, force }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Resolving organization')
            const organization = yield* (yield* Organizations).resolve(
              Option.getOrUndefined(org),
            )
            yield* progress.finish(
              `${organization.name} (${organization.environment})`,
            )
            yield* progress.start('Pulling config')
            const pulled = yield* billing.pull(organization)
            yield* progress.finish(plural(pulled.config.meters.length, 'meter'))
            const saved = yield* billing.save(
              Option.getOrUndefined(file),
              pulled.config,
              force,
            )
            return { organization, pulled, ...saved } satisfies Pulled
          }),
        )
      }),
    render,
    json: ({ file, status, pulled }) => ({ file, status, ...pulled }),
  }),
)
