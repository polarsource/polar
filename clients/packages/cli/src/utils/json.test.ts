import { describe, expect, test } from 'vitest'
import { Console, Effect, Stdio } from 'effect'
import { colorJson, highlight, printJson } from '@/utils/json'
import { captureConsole } from '@/utils/test-utils/cli'

const tag = (name: string) => (text: string) => `<${name}>${text}</${name}>`
const paint = {
  key: tag('key'),
  string: tag('string'),
  number: tag('number'),
  boolean: tag('boolean'),
  null: tag('null'),
}

describe('highlight', () => {
  test('marks keys, strings, numbers, booleans and null', () => {
    expect(
      highlight(
        '{"name": "Pro", "price": -9.5e3, "archived": false, "note": null}',
        paint,
      ),
    ).toBe(
      '{<key>"name"</key>: <string>"Pro"</string>, <key>"price"</key>: <number>-9.5e3</number>, <key>"archived"</key>: <boolean>false</boolean>, <key>"note"</key>: <null>null</null>}',
    )
  })

  test('leaves keywords, numbers and quotes inside strings alone', () => {
    expect(highlight('["true 42 null", "say \\"hi\\": 1"]', paint)).toBe(
      '[<string>"true 42 null"</string>, <string>"say \\"hi\\": 1"</string>]',
    )
  })
})

describe('colorJson', () => {
  const color = (overrides: Partial<Parameters<typeof colorJson>[0]> = {}) =>
    colorJson({
      terminal: true,
      stdinIsTerminal: true,
      env: {},
      ancestors: () => ['zsh', 'login'],
      ...overrides,
    })

  test('colors an interactive shell and stays plain for a runtime', () => {
    expect(color()).toBe(true)
    expect(color({ ancestors: () => ['bash', 'node'] })).toBe(false)
    expect(color({ ancestors: () => ['python3.12'] })).toBe(false)
    expect(color({ ancestors: () => [] })).toBe(false)
  })

  test('stays plain when stdout is piped or stdin is not a terminal', () => {
    expect(color({ terminal: false, env: { FORCE_COLOR: '1' } })).toBe(false)
    expect(color({ stdinIsTerminal: false })).toBe(false)
  })

  test('follows NO_COLOR, FORCE_COLOR, and CI', () => {
    expect(color({ env: { NO_COLOR: '1' } })).toBe(false)
    expect(color({ env: { FORCE_COLOR: '0' } })).toBe(false)
    expect(color({ env: { CI: '1' } })).toBe(false)
    expect(
      color({
        stdinIsTerminal: false,
        ancestors: () => ['node'],
        env: { FORCE_COLOR: '1' },
      }),
    ).toBe(true)
  })
})

describe('printJson', () => {
  const print = (terminal: boolean) => {
    const { lines, console } = captureConsole()
    Effect.runSync(
      printJson({ id: 'prod-1' }).pipe(
        Effect.provide(
          Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(terminal) }),
        ),
        Effect.provideService(Console.Console, console),
      ),
    )
    return lines.join('\n')
  }

  test('prints plain JSON when the output is piped', () => {
    expect(print(false)).toBe('{\n  "id": "prod-1"\n}')
  })

  test('stays valid JSON when stdout is a terminal', () => {
    expect(JSON.parse(print(true))).toEqual({ id: 'prod-1' })
  })
})
