import { render, screen } from '@testing-library/react'
import { schemas } from '@polar-sh/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerMeterActivityCards } from './CustomerMeterPage'
import {
  ParsedMeterQuantities,
  useMeterQuantities,
} from '@/hooks/queries/meters'

vi.mock('@/hooks/queries/meters', () => ({
  useMeterQuantities: vi.fn(),
}))

const CUSTOMER_CREATED_AT = '2025-01-15T00:00:00.000Z'
const ALL_TIME_START_ISO = '2025-01-15T00:00:00.000Z'

const customer = {
  id: 'customer-1',
  created_at: CUSTOMER_CREATED_AT,
  first_user_event_at: null,
} as schemas['Customer']

const meter = { id: 'meter-1', name: 'Test Meter' } as schemas['Meter']

const buildQuantities = (
  total: number,
  buckets: number[],
): ParsedMeterQuantities => ({
  total,
  quantities: buckets.map((quantity, index) => ({
    timestamp: new Date(2025, index, 1),
    quantity,
  })) as ParsedMeterQuantities['quantities'],
})

const mockQuantities = (
  figures: ParsedMeterQuantities | undefined,
  allTime: ParsedMeterQuantities | undefined,
) => {
  vi.mocked(useMeterQuantities).mockImplementation((_id, params) => {
    const isAllTime = params?.start_timestamp === ALL_TIME_START_ISO
    return {
      data: isAllTime ? allTime : figures,
    } as ReturnType<typeof useMeterQuantities>
  })
}

const getCardValue = (title: string): string | undefined => {
  const heading = screen.getByText(title)
  const card = heading.closest('.rounded-3xl')
  const valueSpan = card?.querySelector('.text-4xl')
  return valueSpan?.textContent ?? undefined
}

describe('CustomerMeterActivityCards', () => {
  beforeEach(() => {
    vi.mocked(useMeterQuantities).mockReset()
  })

  it('All Time card shows the period total, not the sum of monthly buckets (non-summable aggregation)', () => {
    // max aggregation: monthly maxima [30, 15, 0] sum to 45, but the global
    // max over the whole range (the `total` field) is 30.
    mockQuantities(buildQuantities(0, [0, 0]), buildQuantities(30, [30, 15, 0]))

    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    expect(getCardValue('All Time')).toBe('30')
    expect(getCardValue('All Time')).not.toBe('45')
  })

  it('All Time card shows the total for a summable aggregation where total equals the sum', () => {
    mockQuantities(buildQuantities(0, [0, 0]), buildQuantities(30, [10, 20]))

    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    expect(getCardValue('All Time')).toBe('30')
  })

  it('Current Month and Previous Month cards each show a single bucket quantity', () => {
    // figuresQuantities.quantities[0] = Previous Month, [1] = Current Month
    mockQuantities(buildQuantities(99, [10, 20]), buildQuantities(0, [0, 0]))

    render(<CustomerMeterActivityCards meter={meter} customer={customer} />)

    expect(getCardValue('Current Month')).toBe('20')
    expect(getCardValue('Previous Month')).toBe('10')
  })
})
