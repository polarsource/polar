import { describe, expect, test } from 'vitest'
import { stripAnsi } from '@/utils/test-utils/cli'
import * as ui from '@/utils/ui'

describe('ui', () => {
  test('prefixes status lines with their glyphs', () => {
    expect(stripAnsi(ui.success('Done'))).toBe('  ✔ Done')
    expect(stripAnsi(ui.warning('Careful'))).toBe('  ▲ Careful')
    expect(stripAnsi(ui.step('Working'))).toBe('  Working')
    expect(stripAnsi(ui.command('polar update'))).toBe('polar update')
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
