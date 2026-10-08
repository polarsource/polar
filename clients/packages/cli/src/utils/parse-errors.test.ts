import { describe, expect, test } from 'vitest'
import { CliError } from 'effect/cli'
import {
  describeUnknownCommand,
  formatter,
  suggest,
  unknownCommand,
} from '@/utils/parse-errors'
import { stripAnsi } from '@/utils/test-utils/cli'

const tree = {
  name: 'polar',
  subcommands: [
    {
      commands: [
        {
          name: 'auth',
          subcommands: [{ commands: [{ name: 'login', subcommands: [] }] }],
        },
        {
          name: 'products',
          subcommands: [
            {
              commands: [
                { name: 'list', subcommands: [] },
                { name: 'get', subcommands: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
}

describe('suggest', () => {
  test('keeps the closest candidates and prefixes', () => {
    expect(suggest(['list', 'get', 'create'], 'lsit')).toEqual(['list'])
    expect(suggest(['products', 'payments'], 'porducts')).toEqual(['products'])
    expect(suggest(['products', 'payments', 'payouts'], 'pay')).toEqual([
      'payments',
      'payouts',
    ])
    expect(suggest(['products'], 'zzzzzzzz')).toEqual([])
  })
})

describe('unknownCommand', () => {
  test('catches a typo at any depth before flags', () => {
    expect(unknownCommand(tree, ['porducts', 'list'])).toEqual({
      path: ['polar'],
      token: 'porducts',
      suggestions: ['products'],
    })
    expect(unknownCommand(tree, ['products', 'lsit'])).toEqual({
      path: ['polar', 'products'],
      token: 'lsit',
      suggestions: ['list'],
    })
  })

  test('leaves valid paths, arguments and flags to the parser', () => {
    expect(unknownCommand(tree, ['products', 'list'])).toBeUndefined()
    expect(unknownCommand(tree, ['products', 'get', 'nope'])).toBeUndefined()
    expect(unknownCommand(tree, ['--json', 'porducts'])).toBeUndefined()
    expect(unknownCommand(tree, [])).toBeUndefined()
  })

  test('renders in the CLI error style', () => {
    expect(
      stripAnsi(
        describeUnknownCommand({
          path: ['polar'],
          token: 'porducts',
          suggestions: ['products'],
        }),
      ),
    ).toBe(
      '  ✖ Unknown command "porducts" for polar\n    Did you mean products?',
    )
    expect(
      stripAnsi(
        describeUnknownCommand({
          path: ['polar'],
          token: 'zzz',
          suggestions: [],
        }),
      ),
    ).toBe(
      '  ✖ Unknown command "zzz" for polar\n    Run polar --help to see every command',
    )
  })
})

describe('formatter', () => {
  const render = (error: CliError.CliError) =>
    stripAnsi(formatter.formatErrors([error])).trim()

  test('unknown flag', () => {
    expect(
      render(
        new CliError.UnrecognizedOption({
          option: '--foo',
          command: ['polar', 'products', 'list'],
          suggestions: [],
        }),
      ),
    ).toBe(
      '✖ Unknown flag --foo for polar products list\n    Run polar products list --help to see the flags',
    )
    expect(
      render(
        new CliError.UnrecognizedOption({
          option: '--limt',
          command: ['polar', 'products', 'list'],
          suggestions: ['--limit'],
        }),
      ),
    ).toContain('Did you mean --limit?')
  })

  test('invalid and missing values', () => {
    expect(
      render(
        new CliError.InvalidValue({
          option: 'limit',
          value: 'abc',
          expected: 'Expected: an integer',
          kind: 'flag',
        }),
      ),
    ).toBe('✖ Invalid value "abc" for --limit\n    Expected an integer')
    expect(
      render(
        new CliError.InvalidValue({
          option: 'limit',
          value: '',
          expected: 'an integer',
          kind: 'flag',
        }),
      ),
    ).toBe('✖ Missing value for --limit\n    Expected an integer')
    expect(render(new CliError.MissingOption({ option: 'name' }))).toBe(
      '✖ Missing required flag --name',
    )
    expect(render(new CliError.MissingArgument({ argument: 'id' }))).toBe(
      '✖ Missing required argument <id>',
    )
  })
})
