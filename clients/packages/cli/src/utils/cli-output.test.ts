import { CliError } from 'effect/cli'
import { describe, expect, test } from 'vitest'
import { formatter } from '@/utils/cli-output'
import { stripAnsi } from '@/utils/test-utils/cli'

const unknown = (subcommand: string, parent: string[]) =>
  stripAnsi(
    formatter.formatErrors([
      new CliError.UnknownSubcommand({ subcommand, parent, suggestions: [] }),
    ]),
  )

describe('formatErrors', () => {
  test.each([
    ['listen', 'webhook listen'],
    ['trigger', 'webhook trigger'],
  ])('suggests the webhook command for polar %s', (subcommand, moved) => {
    expect(unknown(subcommand, ['polar'])).toContain(
      `Did you mean this?\n    ${moved}`,
    )
  })

  test.each([
    [['polar'], 'login', 'auth login'],
    [['polar'], 'whoami', 'auth whoami'],
    [['polar', 'auth'], 'status', 'auth whoami'],
    [['polar', 'webhooks'], 'list', 'webhooks list_webhook_endpoints'],
    [['polar', 'webhooks'], 'listen', 'webhook listen'],
  ])('suggests the real command for %j %s', (parent, subcommand, intended) => {
    expect(unknown(subcommand, parent)).toContain(
      `Did you mean this?\n    ${intended}`,
    )
  })

  test('leaves other unknown subcommands alone', () => {
    expect(unknown('listen', ['polar', 'config'])).not.toContain('Did you mean')
    expect(unknown('nope', ['polar'])).not.toContain('Did you mean')
  })
})
