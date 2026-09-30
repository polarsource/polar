import { describe, expect, test } from 'vitest'
import { stripAnsi } from '@/utils/test-utils/cli'
import * as ui from '@/utils/ui'

const ESC = String.fromCharCode(27)

describe('ui', () => {
  test('prefixes status lines with their glyphs', () => {
    expect(stripAnsi(ui.success('Done'))).toBe('  ✔ Done')
    expect(stripAnsi(ui.warning('Careful'))).toBe('  ▲ Careful')
    expect(stripAnsi(ui.step('Working'))).toBe('  Working')
    expect(stripAnsi(ui.command('polar update'))).toBe('polar update')
  })

  test('announces an available update with the command to install it', () => {
    const notice = stripAnsi(ui.updateNotice('v1.0.0', 'v2.0.0'))
    expect(notice).toContain('Update available v1.0.0 → v2.0.0')
    expect(notice).toContain('Run polar update to install it')
  })

  test('strips control characters from terminal titles', () => {
    expect(ui.pushTitle('Acme\x07\x1b]0;evil\n')).toBe(
      `${ESC}[22;0t${ESC}]0;Acme]0;evil\x07`,
    )
  })

  test('keeps line breaks but drops control characters from response bodies', () => {
    expect(ui.printable(`${ESC}[31mnope${ESC}[0m\r\n\tline`)).toBe(
      '[31mnope[0m\n\tline',
    )
  })

  test('drops unicode format and separator characters that can spoof output', () => {
    expect(ui.printable('ok\u202Edeliaf\u2028\u2029\u200Bdone ✔ 🎉')).toBe(
      'okdeliafdone ✔ 🎉',
    )
    expect(ui.pushTitle('Acme\u202E')).toBe(`${ESC}[22;0t${ESC}]0;Acme\x07`)
  })

  test('renders failures with an optional hint', () => {
    expect(stripAnsi(ui.failure('Broken'))).toBe('  ✖ Broken')
    expect(stripAnsi(ui.failure('Broken', 'Try again'))).toBe(
      '  ✖ Broken\n    Try again',
    )
  })

  test('aligns key value labels to the widest label', () => {
    expect(
      stripAnsi(
        ui.keyValue([
          ['Environment', 'sandbox'],
          ['ID', 'org-1'],
        ]),
      ),
    ).toBe('  Environment  sandbox\n  ID           org-1')
  })

  test('formats status codes with their status text', () => {
    expect(stripAnsi(ui.statusCode(200, 'OK'))).toBe('200 OK')
    expect(stripAnsi(ui.statusCode(404, 'Not Found'))).toBe('404 Not Found')
    expect(stripAnsi(ui.statusCode(500, ''))).toBe('500')
  })

  test('formats timestamps and durations', () => {
    const date = new Date(2026, 0, 1, 13, 5, 9)
    expect(stripAnsi(ui.timestamp(date))).toBe('13:05:09')
    expect(stripAnsi(ui.timestamp())).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(stripAnsi(ui.duration(12.6))).toBe('13ms')
  })
})
