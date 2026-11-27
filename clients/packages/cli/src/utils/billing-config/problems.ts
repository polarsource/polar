import type { ConfigIssue, LoadedConfig } from '@/schemas/BillingConfig'
import * as ui from '@/utils/ui'

export const plural = (count: number, noun: string, nouns = `${noun}s`) =>
  `${count} ${count === 1 ? noun : nouns}`

const quote = (value: string) => `"${value}"`

export const referencedResource = (message: string) =>
  /^No ([\w ]+?) in this config/.exec(message)?.[1]

type SourceLocation = NonNullable<ConfigIssue['location']>

interface Problem {
  readonly mark: string
  readonly color: (text: string) => string
  readonly title: string
  readonly label: string
  readonly help?: string | undefined
  readonly location?: SourceLocation | undefined
  readonly path: string
}

const lowercaseFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1)

const sanitize = (issue: ConfigIssue): ConfigIssue => ({
  ...issue,
  path: ui.printable(issue.path),
  message: ui.printable(issue.message),
  got: issue.got === undefined ? undefined : ui.printable(issue.got),
  suggestion:
    issue.suggestion === undefined ? undefined : ui.printable(issue.suggestion),
})

const unknownEventHelp = (issue: ConfigIssue) =>
  issue.suggestion
    ? `Did you mean ${ui.green(quote(issue.suggestion))}? The meter stays at zero until your app sends an event with this exact name.`
    : `The meter counts events with this name, so it stays at zero until your app sends one. Fine for a new event; if the name looks wrong, compare it with ${ui.command('polar events list_names')}.`

const describeWarning = (issue: ConfigIssue): Problem => {
  const unknownEvent = issue.code === 'unknown_event'
  return {
    mark: ui.bold(ui.yellow('Warning:')),
    color: ui.yellow,
    title:
      unknownEvent && issue.got !== undefined
        ? `No events named ${issue.got} have been received yet`
        : issue.message,
    label: unknownEvent
      ? 'no events with this name yet'
      : lowercaseFirst(issue.message),
    location: issue.location,
    path: issue.path,
    help: unknownEvent ? unknownEventHelp(issue) : undefined,
  }
}

interface ErrorDetails {
  readonly issue: ConfigIssue
  readonly key: string
  readonly parent: string
  readonly message: string
  readonly label: string
}

type ErrorText = Pick<Problem, 'title' | 'label' | 'help'>

const asMessage = ({ message, label }: ErrorDetails): ErrorText => ({
  title: message,
  label,
})

const duplicate = ({ issue, key }: ErrorDetails): ErrorText => ({
  title: `Duplicate ${key === 'field' ? 'custom field' : key} ${issue.got ?? quote(key)}`,
  label: 'already used by another entry',
})

const ERRORS = new Map<string, (details: ErrorDetails) => ErrorText>(
  Object.entries({
    value_error: asMessage,
    missing: ({ key, parent }) => ({
      title: `Missing ${quote(key)} in ${parent}`,
      label: `${quote(key)} should be set here`,
    }),
    extra_forbidden: ({ key, parent }) => ({
      title: parent
        ? `Unknown key ${quote(key)} in ${parent}`
        : `Unknown section ${quote(key)}`,
      label: parent ? 'not a known key' : 'not a known section',
    }),
    meter_locked: ({ key, parent }) => ({
      title: `Cannot change ${quote(key)} of ${parent}`,
      label: 'the meter is already aggregating events',
    }),
    duplicate_external_id: duplicate,
    duplicate_slug: duplicate,
    unknown_reference: ({ issue, key, message }) => {
      const resource = referencedResource(message) ?? 'entry'
      return {
        title: `Unknown ${resource} ${issue.got ?? quote(key)}`,
        label: `not a ${resource} in this config`,
      }
    },
    missing_currency: asMessage,
    not_supported: asMessage,
    deprecated_reference: asMessage,
    type_changed: asMessage,
    interval_changed: asMessage,
    invalid_prices: asMessage,
    limit_exceeded: asMessage,
    meter_cycle_unused: asMessage,
  }),
)

const invalidValue = ({ issue, key, label }: ErrorDetails): ErrorText => ({
  title: issue.path
    ? `Invalid value for ${quote(key)} at ${issue.path}`
    : issue.message,
  label,
  help: issue.location ? undefined : `Got ${issue.got ?? 'nothing'}.`,
})

const errorHelp = (issue: ConfigIssue) => {
  if (issue.suggestion) {
    return `Did you mean ${ui.green(quote(issue.suggestion))}?`
  }
  if (issue.location) return undefined
  return issue.got && `Got ${issue.got}.`
}

const describeError = (issue: ConfigIssue): Problem => {
  const segments = issue.path.split('.')
  const message = issue.message.replace(/^Value error, /, '')
  const details: ErrorDetails = {
    issue,
    key: segments.at(-1) ?? issue.path,
    parent: segments.slice(0, -1).join('.'),
    message,
    label: lowercaseFirst(message).replace(/^input should be /, 'expected '),
  }
  return {
    mark: ui.bold(ui.red('Error:')),
    color: ui.red,
    location: issue.location,
    path: issue.path,
    help: errorHelp(issue),
    ...(ERRORS.get(issue.code) ?? invalidValue)(details),
  }
}

const describe = (issue: ConfigIssue): Problem =>
  issue.severity === 'warning' ? describeWarning(issue) : describeError(issue)

const where = (config: LoadedConfig, problem: Problem) => {
  if (problem.location) {
    return [
      ui.codeFrame(config.source, {
        file: config.file,
        location: problem.location,
        label: problem.label,
        color: problem.color,
      }),
    ]
  }
  if (problem.path) {
    return [
      `${ui.INDENT}${ui.INDENT}${ui.dim('at')} ${config.file} ${ui.dim('›')} ${problem.path}`,
    ]
  }
  return []
}

const render = (config: LoadedConfig, problem: Problem) =>
  [
    `${ui.INDENT}${problem.mark} ${problem.color(problem.title)}`,
    ...where(config, problem),
    ...(problem.help
      ? [`${ui.INDENT}${ui.bold(ui.cyan('help:'))} ${problem.help}`]
      : []),
  ].join('\n')

export const formatProblems = (
  config: LoadedConfig,
  issues: ReadonlyArray<ConfigIssue>,
) =>
  issues.map((issue) => render(config, describe(sanitize(issue)))).join('\n\n')
