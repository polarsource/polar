import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/queries/meters', () => ({
  useMeterQuantities: vi.fn(),
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Avatar: () => null,
}))

import { useMeterQuantities } from '@/hooks/queries/meters'
import { CustomerMeterActivityCards } from './CustomerMeterPage'

const mockedQuantities = vi.mocked(useMeterQuantities)
type QuantitiesResult = ReturnType<typeof useMeterQuantities>

const emptyResult = { data: undefined } as unknown as QuantitiesResult

const meter = { id: 'met_1' } as React.ComponentProps<
  typeof CustomerMeterActivityCards
>['meter']

const customer = {
  id: 'cus_1',
  created_at: '2024-01-15T12:00:00.000Z',
  first_user_event_at: null,
} as React.ComponentProps<typeof CustomerMeterActivityCards>['customer']

describe('CustomerMeterActivityCards', () => {
  afterEach(() => {
    cleanup()
    mockedQuantities.mockReset()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('sends local-timezone month boundaries in a negative UTC offset (PDT)', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    vi.setSystemTime(new Date('2026-09-15T17:00:00Z')) // Sep 15 10:00 PDT

    mockedQuantities.mockReturnValue(emptyResult)
    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    const figuresParams = mockedQuantities.mock.calls[0][1]!
    expect(figuresParams.start_timestamp).toBe('2026-08-01T07:00:00.000Z')
    expect(figuresParams.end_timestamp).toBe('2026-10-01T06:59:59.999Z')
    expect(figuresParams.interval).toBe('month')
    expect(figuresParams.customer_id).toBe('cus_1')

    const allTimeParams = mockedQuantities.mock.calls[1][1]!
    expect(allTimeParams.start_timestamp).toBe('2024-01-15T12:00:00.000Z')
    expect(allTimeParams.end_timestamp).toBe('2026-09-15T17:00:00.000Z')
    expect(allTimeParams.interval).toBe('month')
  })

  it('sends local-timezone month boundaries east of UTC (JST)', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    vi.setSystemTime(new Date('2026-09-15T17:00:00Z')) // Sep 16 02:00 JST

    mockedQuantities.mockReturnValue(emptyResult)
    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    const figuresParams = mockedQuantities.mock.calls[0][1]!
    expect(figuresParams.start_timestamp).toBe('2026-07-31T15:00:00.000Z')
    expect(figuresParams.end_timestamp).toBe('2026-09-30T14:59:59.999Z')
  })

  it('sends UTC month boundaries at UTC', () => {
    vi.stubEnv('TZ', 'UTC')
    vi.setSystemTime(new Date('2026-09-15T17:00:00Z'))

    mockedQuantities.mockReturnValue(emptyResult)
    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    const figuresParams = mockedQuantities.mock.calls[0][1]!
    expect(figuresParams.start_timestamp).toBe('2026-08-01T00:00:00.000Z')
    expect(figuresParams.end_timestamp).toBe('2026-09-30T23:59:59.999Z')
  })

  it('renders the current and previous month quantities against the local buckets (PDT)', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    vi.setSystemTime(new Date('2026-09-15T17:00:00Z')) // Sep 15 10:00 PDT

    mockedQuantities.mockImplementation((_id, params) => {
      if (params!.start_timestamp === '2024-01-15T12:00:00.000Z') {
        return {
          data: {
            quantities: [
              {
                timestamp: new Date('2024-01-15T12:00:00.000Z'),
                quantity: 130,
              },
            ],
            total: 130,
          },
        } as unknown as QuantitiesResult
      }
      return {
        data: {
          quantities: [
            { timestamp: new Date('2026-08-01T07:00:00.000Z'), quantity: 50 },
            { timestamp: new Date('2026-09-01T07:00:00.000Z'), quantity: 70 },
          ],
          total: 120,
        },
      } as unknown as QuantitiesResult
    })

    const { container } = render(
      <CustomerMeterActivityCards meter={meter} customer={customer} />,
    )

    const valueSpans = container.querySelectorAll('span.text-4xl')
    expect(valueSpans).toHaveLength(3)
    expect(valueSpans[0]!.textContent).toBe('70') // Current Month
    expect(valueSpans[1]!.textContent).toBe('50') // Previous Month
    expect(valueSpans[2]!.textContent).toBe('130') // All Time

    const text = container.textContent ?? ''
    expect(text).toContain('Current Month')
    expect(text).toContain('September 1')
    expect(text).toContain('September 30')
    expect(text).toContain('Previous Month')
    expect(text).toContain('August 1')
    expect(text).toContain('August 31')
    expect(text).toContain('All Time')
    expect(text).toContain('January 15, 2024')
  })
})
