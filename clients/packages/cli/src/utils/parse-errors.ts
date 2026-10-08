import type { CliError } from 'effect/cli'
import { CliOutput } from 'effect/cli'
import * as ui from '@/utils/ui'

export interface CommandTree {
  readonly name: string
  readonly subcommands: ReadonlyArray<{
    readonly commands: ReadonlyArray<CommandTree>
  }>
}

const MAX_DISTANCE = 3

const distance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[b.length]!
}

export const suggest = (candidates: ReadonlyArray<string>, input: string) => {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: candidate.startsWith(input) ? 0 : distance(candidate, input),
    }))
    .filter(({ score }) => score <= MAX_DISTANCE)
    .sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate))
  const best = scored[0]?.score
  return scored
    .filter(
      ({ candidate, score }) => score === best || candidate.startsWith(input),
    )
    .map(({ candidate }) => candidate)
}

const didYouMean = (suggestions: ReadonlyArray<string>) =>
  suggestions.length === 0
    ? undefined
    : `Did you mean ${suggestions.slice(0, 3).join(', ')}?`

export interface UnknownCommand {
  readonly path: ReadonlyArray<string>
  readonly token: string
  readonly suggestions: ReadonlyArray<string>
}

export const unknownCommand = (
  root: CommandTree,
  args: ReadonlyArray<string>,
): UnknownCommand | undefined => {
  const path = [root.name]
  let current = root
  for (const token of args) {
    if (token.startsWith('-')) return undefined
    const candidates = current.subcommands.flatMap((group) => group.commands)
    if (candidates.length === 0) return undefined
    const next = candidates.find((child) => child.name === token)
    if (!next) {
      return {
        path,
        token,
        suggestions: suggest(
          candidates.map((child) => child.name),
          token,
        ),
      }
    }
    path.push(next.name)
    current = next
  }
  return undefined
}

export const describeUnknownCommand = ({
  path,
  token,
  suggestions,
}: UnknownCommand) =>
  ui.failure(
    `Unknown command "${ui.printable(token)}" for ${path.join(' ')}`,
    didYouMean(suggestions) ??
      `Run ${path.join(' ')} --help to see every command`,
  )

const describe = (
  error: CliError.CliError,
): { title: string; hint?: string | undefined } => {
  switch (error._tag) {
    case 'UnrecognizedOption': {
      const command = error.command?.join(' ')
      return {
        title: `Unknown flag ${error.option}${command ? ` for ${command}` : ''}`,
        hint:
          didYouMean(error.suggestions) ??
          (command ? `Run ${command} --help to see the flags` : undefined),
      }
    }
    case 'UnknownSubcommand': {
      const parent = error.parent?.join(' ')
      return {
        title: `Unknown command "${error.subcommand}"${parent ? ` for ${parent}` : ''}`,
        hint: didYouMean(error.suggestions),
      }
    }
    case 'MissingOption':
      return { title: `Missing required flag --${error.option}` }
    case 'MissingArgument':
      return { title: `Missing required argument <${error.argument}>` }
    case 'UnexpectedArgument':
      return {
        title: `Unexpected ${error.arguments.length === 1 ? 'argument' : 'arguments'} ${error.arguments.map((value) => JSON.stringify(value)).join(', ')}`,
      }
    case 'InvalidValue': {
      const expected = error.expected.replace(/^Expected:?\s*/, '')
      const subject =
        error.kind === 'argument' ? `<${error.option}>` : `--${error.option}`
      return error.value.length === 0
        ? {
            title: `Missing value for ${subject}`,
            hint: `Expected ${expected}`,
          }
        : {
            title: `Invalid value ${JSON.stringify(error.value)} for ${subject}`,
            hint: `Expected ${expected}`,
          }
    }
    default:
      return { title: error.message }
  }
}

const formatCliError = (error: CliError.CliError) => {
  const { title, hint } = describe(error)
  return `\n${ui.failure(ui.printable(title), hint && ui.printable(hint))}\n`
}

export const formatter: CliOutput.Formatter = {
  ...CliOutput.defaultFormatter(),
  formatError: formatCliError,
  formatErrors: (errors) => errors.map(formatCliError).join('\n'),
}
