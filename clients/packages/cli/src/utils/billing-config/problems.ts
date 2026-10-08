import type { ConfigIssue, LoadedConfig } from '@/schemas/BillingConfig'
import * as ui from '@/utils/ui'

export const plural = (count: number, noun: string, nouns = `${noun}s`) =>
  `${count} ${count === 1 ? noun : nouns}`

const quote = (value: string) => `"${value}"`

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
})

const describe = (issue: ConfigIssue): Problem => {
  const segments = issue.path.split('.')
  const key = segments.at(-1) ?? issue.path
  const parent = segments.slice(0, -1).join('.')
  if (issue.severity === 'warning') {
    return {
      mark: ui.bold(ui.yellow('Warning:')),
      color: ui.yellow,
      title:
        issue.code === 'unknown_event' && issue.got !== undefined
          ? `No events named ${issue.got} have been received yet`
          : issue.message,
      label:
        issue.code === 'unknown_event'
          ? 'no events with this name yet'
          : lowercaseFirst(issue.message),
      location: issue.location,
      path: issue.path,
    }
  }
  const base = {
    mark: ui.bold(ui.red('Error:')),
    color: ui.red,
    location: issue.location,
    path: issue.path,
    help: issue.location ? undefined : issue.got && `Got ${issue.got}.`,
  }
  const message = issue.message.replace(/^Value error, /, '')
  const label = lowercaseFirst(message).replace(
    /^input should be /,
    'expected ',
  )
  switch (issue.code) {
    case 'value_error':
      return { ...base, title: message, label }
    case 'missing':
      return {
        ...base,
        title: `Missing ${quote(key)} in ${parent}`,
        label: `${quote(key)} should be set here`,
      }
    case 'extra_forbidden':
      return {
        ...base,
        title: parent
          ? `Unknown key ${quote(key)} in ${parent}`
          : `Unknown section ${quote(key)}`,
        label: parent ? 'not a known key' : 'not a known section',
      }
    case 'meter_locked':
      return {
        ...base,
        title: `Cannot change ${quote(key)} of ${parent}`,
        label: 'the meter is already aggregating events',
      }
    case 'duplicate_external_id':
      return {
        ...base,
        title: `Duplicate external_id ${issue.got ?? quote(key)}`,
        label: 'already used by another entry',
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
            file: config.file,
            location: problem.location,
            label: problem.label,
            color: problem.color,
          }),
        ]
      : problem.path
        ? [
            `${ui.INDENT}${ui.INDENT}${ui.dim('at')} ${config.file} ${ui.dim('›')} ${problem.path}`,
          ]
        : []),
    ...(problem.help ? [`${ui.INDENT}${ui.dim('help:')} ${problem.help}`] : []),
  ].join('\n')

export const formatProblems = (
  config: LoadedConfig,
  issues: ReadonlyArray<ConfigIssue>,
) =>
  issues.map((issue) => render(config, describe(sanitize(issue)))).join('\n\n')
