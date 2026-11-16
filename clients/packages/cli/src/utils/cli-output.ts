import { CliError, CliOutput } from 'effect/cli'

const MOVED = new Map([
  ['polar listen', 'webhook listen'],
  ['polar trigger', 'webhook trigger'],
  ['polar auth status', 'whoami'],
  ['polar products archive', 'update <id> --is-archived=true'],
])

const suggestMoved = (error: CliError.CliError) => {
  if (error._tag !== 'UnknownSubcommand' || error.parent === undefined) {
    return error
  }
  const moved = MOVED.get([...error.parent, error.subcommand].join(' '))
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
