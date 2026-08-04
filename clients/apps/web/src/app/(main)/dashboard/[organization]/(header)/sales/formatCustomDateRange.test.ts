import { describe, expect, it, vi } from 'vitest'
import { formatCustomDateRange } from './formatCustomDateRange'

describe('formatCustomDateRange', () => {
  it('formats a same-day range as a single date', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2026-06-15T00:00:00Z'),
      to: new Date('2026-06-15T23:59:59Z'),
    })
    expect(label).toMatch(/Jun\s*15/)
    vi.useRealTimers()
  })

  it('formats a range within the same month and year without repeating month/year', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2026-06-10T00:00:00Z'),
      to: new Date('2026-06-20T23:59:59Z'),
    })
    expect(label).toBe('Jun 10 – 20')
    vi.useRealTimers()
  })

  it('formats a range spanning months within the same year', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2026-01-15T00:00:00Z'),
      to: new Date('2026-02-20T23:59:59Z'),
    })
    expect(label).toBe('Jan 15 – Feb 20')
    vi.useRealTimers()
  })

  it('includes the year when the range spans the current year boundary', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2025-12-15T00:00:00Z'),
      to: new Date('2026-01-20T23:59:59Z'),
    })
    expect(label).toBe('Dec 15, 2025 – Jan 20, 2026')
    vi.useRealTimers()
  })

  it('formats a fully historical range spanning multiple years', () => {
    vi.useFakeTimers().setSystemTime(new Date('2028-01-01T00:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2024-03-01T00:00:00Z'),
      to: new Date('2025-07-15T23:59:59Z'),
    })
    expect(label).toBe('Mar 1, 2024 – Jul 15, 2025')
    vi.useRealTimers()
  })

  it('produces a non-empty label for the URL-shared custom range from the bug report', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-08-04T12:00:00Z'))
    const label = formatCustomDateRange({
      from: new Date('2026-01-15T00:00:00.000Z'),
      to: new Date('2026-02-20T23:59:59.999Z'),
    })
    expect(label).toBe('Jan 15 – Feb 20')
    expect(label.length).toBeGreaterThan(0)
    vi.useRealTimers()
  })
})
