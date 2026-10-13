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

  test('leaves other unknown subcommands alone', () => {
    expect(unknown('listen', ['polar', 'config'])).not.toContain('Did you mean')
    expect(unknown('nope', ['polar'])).not.toContain('Did you mean')
  })
})
