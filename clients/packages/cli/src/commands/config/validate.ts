import { Console, Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { org } from '@/commands/flags'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  ConfigError,
  type ConfigIssue,
  type LoadedConfig,
} from '@/schemas/Config'
import { Config } from '@/services/config'
import { Organizations } from '@/services/organizations'
import { formatDuration, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Path to the billing config file. Defaults to polar.config.ts, polar.config.js or polar.json in the current directory',
  ),
  Argument.optional,
)

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

const quote = (value: string) => `"${value}"`

interface Problem {
  readonly mark: string
  readonly color: (text: string) => string
  readonly title: string
  readonly label: string
  readonly help?: string | undefined
  readonly location?: SourceLocation | undefined
}

type SourceLocation = NonNullable<ConfigIssue['location']>

const lowercaseFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1)

const sanitize = (issue: ConfigIssue): ConfigIssue => ({
  ...issue,
  path: ui.printable(issue.path),
  message: ui.printable(issue.message),
  got: issue.got === undefined ? undefined : ui.printable(issue.got),
})

const describe = (issue: ConfigIssue): Problem => {
  const segments = issue.path.split('.')
  const key = segments.at(-1) ?? issue.path
  const parent = segments.slice(0, -1).join('.')
  if (issue.severity === 'warning') {
    return {
      mark: ui.bold(ui.yellow('Warning:')),
      color: ui.yellow,
      title: issue.message,
      label:
        issue.code === 'unknown_event'
          ? 'no events with this name yet'
          : lowercaseFirst(issue.message),
      location: issue.location,
    }
  }
  const base = {
    mark: ui.bold(ui.red('Error:')),
    color: ui.red,
    location: issue.location,
  }
  const label = lowercaseFirst(issue.message).replace(
    /^input should be /,
    'expected ',
  )
  switch (issue.code) {
    case 'missing':
      return {
        ...base,
        title: `Missing ${quote(key)} in ${parent}`,
        label: `${quote(key)} should be set here`,
      }
    case 'extra_forbidden':
      return {
        ...base,
        title: `Unknown key ${quote(key)} in ${parent}`,
        label: 'not a known key',
      }
    case 'unknown_section':
      return {
        ...base,
        title: `Unknown section ${quote(key)}`,
        label: 'not a known section',
      }
    case 'duplicate_external_id':
      return {
        ...base,
        title: `Duplicate external_id ${issue.got ?? quote(key)}`,
        label,
      }
    default:
      return {
        ...base,
        title: issue.path
          ? `Invalid value for ${quote(key)} at ${issue.path}`
          : issue.message,
        label,
        help: issue.location ? undefined : `Got ${issue.got ?? 'nothing'}.`,
      }
  }
}

const render = (config: LoadedConfig, problem: Problem) =>
  [
    `${ui.INDENT}${problem.mark} ${problem.title}`,
    ...(problem.location
      ? [
          ui.codeFrame(config.source, {
            file: config.generated ? `${config.file} as JSON` : config.file,
            location: problem.location,
            label: problem.label,
            color: problem.color,
          }),
        ]
      : []),
    ...(problem.help ? [`${ui.INDENT}${ui.dim('help:')} ${problem.help}`] : []),
  ].join('\n')

export const formatProblems = (
  config: LoadedConfig,
  issues: ReadonlyArray<ConfigIssue>,
) =>
  issues.map((issue) => render(config, describe(sanitize(issue)))).join('\n\n')

const count = (
  issues: ReadonlyArray<ConfigIssue>,
  severity: ConfigIssue['severity'],
) => issues.filter((issue) => issue.severity === severity).length

export const summary = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Found ${plural(count(issues, 'error'), 'error')} and ${plural(count(issues, 'warning'), 'warning')}.`

const meterCount = (config: LoadedConfig) => {
  const meters =
    typeof config.input === 'object' &&
    config.input !== null &&
    'meters' in config.input
      ? config.input.meters
      : undefined
  return Array.isArray(meters) ? meters.length : 0
}

export const finished = (
  duration: Duration.Duration,
  config: LoadedConfig,
  organization: ActiveOrganization,
) =>
  ui.dim(
    `${ui.INDENT}Finished in ${Math.round(Duration.toMillis(duration))}ms on ${config.file} with ${plural(meterCount(config), 'meter')}. Checked against ${ui.bold(organization.name)} ${ui.dim(`(${organization.environment})`)}.`,
  )

export const validate = Command.make(
  'validate',
  { file, org },
  ({ file, org }) =>
    Effect.gen(function* () {
      const service = yield* Config
      const [duration, { config, organization, issues }] = yield* Effect.timed(
        withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Reading config')
            const config = yield* service.load(Option.getOrUndefined(file))
            yield* progress.finish(config.file)
            yield* progress.start('Resolving organization')
            const organization = yield* (yield* Organizations).resolve(
              Option.getOrUndefined(org),
            )
            yield* progress.finish(
              `${organization.name} (${organization.environment})`,
            )
            yield* progress.start('Validating config')
            const [elapsed, issues] = yield* Effect.timed(
              service.validate(config, organization),
            )
            yield* progress.finish(formatDuration(elapsed))
            return { config, organization, issues }
          }),
        ),
      )
      const errors = count(issues, 'error')
      if (issues.length > 0) {
        yield* Console.log(ui.blank)
        yield* Console.log(formatProblems(config, issues))
        yield* Console.log(ui.blank)
        yield* Console.log(summary(issues))
      } else {
        yield* Console.log(
          ui.success(
            `${config.file} is valid: ${plural(meterCount(config), 'meter')}`,
          ),
        )
      }
      yield* Console.log(finished(duration, config, organization))
      if (errors > 0) {
        return yield* new ConfigError({
          message: `${config.file} is not a valid billing config`,
        })
      }
    }),
).pipe(
  Command.withDescription(
    'Check a billing config file against your organization',
  ),
)
