import { Duration, Effect, Option, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import { changeCount, tally } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import {
  changes,
  errors,
  found,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm, configFile as file, org } from '@/utils/flags'
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

const confirmed = confirm.pipe(Flag.withAlias('aladåb'))
const name = Flag.String('name').pipe(
  Flag.optional,
  Flag.withDescription(
    'Name the catalog version this apply publishes, shown on the Versions page',
  ),
)

const applied = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  unchanged(entries)
    ? ui.success(`${target(organization)} is up to date, nothing to apply`)
    : `${ui.INDENT}${config.file} applied to ${target(organization)}: ${plural(entries.length, 'entry', 'entries')} (${tally(entries)})`

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
    : unchanged(result.entries)
      ? [ui.blank, applied(config, organization, result.entries)]
      : [applied(config, organization, result.entries)]

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const approve = (
  organization: ActiveOrganization,
  json: boolean,
  confirmed: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    if (confirmed) return true
    if (json || !(yield* interactive)) {
      return yield* new BillingConfigError({
        message: `Confirmation needed to apply to ${target(organization)}`,
        hint: 'Pass --confirm to apply without asking, after reviewing polar config plan.',
      })
    }
    yield* say([ui.blank])
    return yield* Prompt.run(
      Prompt.Confirm({
        message: `Apply these changes to ${target(organization)}?`,
      }),
    ).pipe(Effect.orElseSucceed(() => false))
  })

export const apply = Command.make('apply', { file, org, confirmed, name }).pipe(
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
      command: 'polar config apply --confirm',
      description: 'Apply without asking, for scripts and CI',
    },
    {
      command: 'polar config apply --confirm --json',
      description: 'Print what was applied as JSON, for scripts and agents',
    },
    {
      command: 'polar config apply --name "Spring pricing"',
      description: 'Name the catalog version this apply publishes',
    },
  ]),
  output({
    result: ApplyOutput,
    run: ({ file, org, confirmed, name }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        const milliseconds = (elapsed: Duration.Duration) =>
          `${Math.round(Duration.toMillis(elapsed))}ms`
        return yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Comparing')
              const [planned, { organization, plan }] = yield* Effect.timed(
                Effect.gen(function* () {
                  const organization = yield* (yield* Organizations).resolve(
                    Option.getOrUndefined(org),
                  )
                  const plan = yield* billing.plan(config, organization)
                  return { organization, plan }
                }),
              )
              yield* progress.finish(milliseconds(planned))
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
                  result: {
                    status: 'applied',
                    entries: plan.entries,
                    issues: plan.issues,
                  } as const,
                }
              }
              yield* say(changes(config, organization, plan))
              if (!(yield* approve(organization, json, confirmed, say))) {
                return yield* new BillingConfigError({
                  message: 'Apply cancelled, nothing changed',
                })
              }
              yield* say([ui.blank])
              yield* progress.start(
                `Applying ${plural(changeCount(plan.entries), 'change')}`,
              )
              const [elapsed, result] = yield* Effect.timed(
                billing.apply(config, organization, {
                  name: Option.getOrUndefined(name),
                }),
              )
              yield* progress.finish(`(${milliseconds(elapsed)})`)
              return {
                config,
                organization,
                result:
                  result.status === 'applied'
                    ? { ...result, issues: plan.issues }
                    : result,
              }
            }),
          'columns',
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
