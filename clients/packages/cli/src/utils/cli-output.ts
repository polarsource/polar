import { CliError, CliOutput } from 'effect/cli'

const GUESSED = new Map([
  ['listen', 'webhook listen'],
  ['trigger', 'webhook trigger'],
  ['login', 'auth login'],
  ['logout', 'auth logout'],
  ['whoami', 'auth whoami'],
  ['org', 'auth org'],
  ['auth status', 'auth whoami'],
  ['webhook_endpoints', 'webhooks'],
  ['webhooks list', 'webhooks list_webhook_endpoints'],
  ['webhooks listen', 'webhook listen'],
  ['webhooks trigger', 'webhook trigger'],
])

const suggestGuessed = (error: CliError.CliError) => {
  if (error._tag !== 'UnknownSubcommand') return error
  const intended = GUESSED.get(
    [...(error.parent ?? []).slice(1), error.subcommand].join(' '),
  )
  return intended === undefined
    ? error
    : new CliError.UnknownSubcommand({
        subcommand: error.subcommand,
        parent: error.parent,
        suggestions: [intended],
      })
}

const base = CliOutput.defaultFormatter()

export const formatter: CliOutput.Formatter = {
  ...base,
  formatErrors: (errors) => base.formatErrors(errors.map(suggestGuessed)),
}
