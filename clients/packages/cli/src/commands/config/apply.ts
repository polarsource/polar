import { Duration, Effect, Option, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import { tally } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import {
  changes,
  errors,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type AppliedEntry,
  type ApplyResult,
  BillingConfigError,
  type LoadedConfig,
  ApplyOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const yes = Flag.Boolean('yes').pipe(
  Flag.withAlias('y'),
  Flag.withDefault(false),
  Flag.withDescription('Apply without asking for confirmation'),
)

const applied = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  unchanged(entries)
    ? ui.success(`${target(organization)} is up to date, nothing to apply`)
    : ui.success(
        `${config.file} applied to ${target(organization)}: ${plural(entries.length, 'entry', 'entries')} (${tally(entries)})`,
      )

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: ApplyResult,
) =>
  result.status === 'rejected'
    ? [
        ui.blank,
        formatProblems(config, result.issues),
        ui.blank,
        `${ui.INDENT}Found ${plural(result.issues.length, 'error')}.`,
      ]
    : [ui.blank, applied(config, organization, result.entries)]

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const confirm = (
  organization: ActiveOrganization,
  json: boolean,
  yes: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    if (yes) return true
    if (json || !(yield* interactive)) {
      return yield* new BillingConfigError({
        message: `Confirmation needed to apply to ${target(organization)}`,
        hint: 'Pass --yes to apply without asking, after reviewing polar config plan.',
      })
    }
    yield* say([ui.blank])
    return yield* Prompt.run(
      Prompt.Confirm({
        message: `Apply these changes to ${target(organization)}?`,
      }),
    ).pipe(Effect.orElseSucceed(() => false))
  })

export const apply = Command.make('apply', { file, org, yes }).pipe(
  Command.withDescription(
    'Create or update everything in a billing config file for your organization',
  ),
  Command.withExamples([
    {
      command: 'polar config apply',
      description:
        'Show what applying polar.config.ts would change, then apply after confirmation',
    },
    {
      command: 'polar config apply billing/polar.json',
      description: 'Apply a specific file',
    },
    {
      command: 'polar config apply --org acme',
      description: 'Apply to another organization, by slug or ID',
    },
    {
      command: 'polar config apply --yes',
      description: 'Apply without asking, for scripts and CI',
    },
    {
      command: 'polar config apply --yes --json',
      description: 'Print what was applied as JSON, for scripts and agents',
    },
  ]),
  output({
    result: ApplyOutput,
    run: ({ file, org, yes }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Reading config')
            const config = yield* billing.load(Option.getOrUndefined(file))
            yield* progress.finish(config.file)
            yield* progress.start('Resolving organization')
            const organization = yield* (yield* Organizations).resolve(
              Option.getOrUndefined(org),
            )
            yield* progress.finish(target(organization))
            yield* progress.start('Checking config')
            const plan = yield* billing.plan(config, organization)
            yield* progress.finish()
            if (errors(plan.issues) > 0) {
              return {
                config,
                organization,
                result: { status: 'rejected', issues: plan.issues } as const,
              }
            }
            if (unchanged(plan.entries)) {
              if (plan.issues.length > 0) {
                yield* say([ui.blank, formatProblems(config, plan.issues)])
              }
              return {
                config,
                organization,
                result: { status: 'applied', entries: plan.entries } as const,
              }
            }
            yield* say(changes(config, plan))
            if (!(yield* confirm(organization, json, yes, say))) {
              return yield* new BillingConfigError({
                message: 'Apply cancelled, nothing changed',
              })
            }
            yield* progress.start('Applying config')
            const [elapsed, result] = yield* Effect.timed(
              billing.apply(config, organization),
            )
            yield* progress.finish(
              `${Math.round(Duration.toMillis(elapsed))}ms`,
            )
            return { config, organization, result }
          }),
        )
      }),
    render: ({ config, organization, result }) =>
      render(config, organization, result),
    json: ({ config, result }) => ({ file: config.file, ...result }),
    failed: ({ config, result }) =>
      result.status === 'rejected'
        ? new BillingConfigError({ message: `${config.file} was not applied` })
        : undefined,
  }),
)
