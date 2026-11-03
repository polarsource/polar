import { CliError, CliOutput } from 'effect/cli'

const MOVED = new Map([
  ['listen', 'webhook listen'],
  ['trigger', 'webhook trigger'],
])

const suggestMoved = (error: CliError.CliError) => {
  if (error._tag !== 'UnknownSubcommand' || error.parent?.length !== 1) {
    return error
  }
  const moved = MOVED.get(error.subcommand)
  return moved === undefined
    ? error
    : new CliError.UnknownSubcommand({
        subcommand: error.subcommand,
        parent: error.parent,
        suggestions: [moved],
      })
}

const base = CliOutput.defaultFormatter()

export const formatter: CliOutput.Formatter = {
  ...base,
  formatErrors: (errors) => base.formatErrors(errors.map(suggestMoved)),
}
