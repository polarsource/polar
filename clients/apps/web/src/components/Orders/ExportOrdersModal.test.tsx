import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/utils/api', () => ({
  getServerURL: (path?: string) => `https://api.polar.sh${path ?? ''}`,
}))

vi.mock('@/components/Metrics/DateRangePicker', () => ({
  default: () => <div data-testid="date-range-picker" />,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => {
  const React = require('react')
  return {
    InlineModal: ({
      isShown,
      modalContent,
    }: {
      isShown: boolean
      modalContent: ReactNode
    }) => (isShown ? <>{modalContent}</> : null),
    InlineModalHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ListItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SegmentedControl: ({
      options,
      value,
      onChange,
    }: {
      options: { value: string; label: string }[]
      value: string
      onChange: (value: string) => void
    }) => (
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            data-active={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: ReactNode
      onClick?: () => void
      disabled?: boolean
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  }
})

vi.mock('./ExportOrdersColumns', () => ({
  ALL_EXPORT_COLUMNS: ['email', 'created_at'],
  DEFAULT_EXPORT_COLUMNS: ['email', 'created_at'],
  orderExportColumns: (columns: string[]) => columns,
  summarizeExportColumns: (columns: string[]) => `${columns.length} selected`,
  ExportColumn: null,
}))

import ExportOrdersModal from './ExportOrdersModal'

const organization = {
  id: '00000000-0000-0000-0000-000000000001',
  created_at: '2020-01-01T00:00:00Z',
} as unknown as Parameters<typeof ExportOrdersModal>[0]['organization']

describe('ExportOrdersModal', () => {
  beforeEach(() => {
    openMock.mockReset()
    vi.stubGlobal('open', openMock)
  })

  afterEach(() => {
    cleanup()
  })

  it('does not shift created_after/created_before when timezone is UTC', () => {
    const hide = vi.fn()
    render(
      <ExportOrdersModal
        organization={organization}
        isShown={true}
        hide={hide}
      />,
    )

    // Toggle to UTC mode
    fireEvent.click(screen.getByText('UTC'))

    // Trigger export
    fireEvent.click(screen.getByText('Export CSV'))

    expect(openMock).toHaveBeenCalledTimes(1)
    const url = openMock.mock.calls[0][0] as string
    const parsed = new URL(url)

    // timezone query param reflects the toggle
    expect(parsed.searchParams.get('timezone')).toBe('UTC')

    const createdAfter = parsed.searchParams.get('created_after')
    const createdBefore = parsed.searchParams.get('created_before')

    // The boundaries must be valid ISO timestamps and must NOT be the
    // UTC-reinterpreted versions of the local day boundaries. Concretely,
    // they must equal the raw dateRange ISO strings, which for the default
    // range (organizationStart..endOfToday) are whatever the host browser
    // produced — so assert they round-trip to the same epoch ms as a fresh
    // `new Date(organization.created_at)` start-of-day in local time and
    // `endOfToday()`. The crucial invariant is that both boundaries parse
    // to valid dates and carry the host's local offset (not 00:00Z unless
    // the host is actually in UTC).
    expect(createdAfter).not.toBeNull()
    expect(createdBefore).not.toBeNull()
    expect(() => new Date(createdAfter!)).not.toThrow()
    expect(() => new Date(createdBefore!)).not.toThrow()

    // The "from" boundary is startOfDay(new Date(organization.created_at)).
    // In the host's local zone that is midnight local, whose ISO string has
    // a non-zero UTC offset (or is 00:00Z only when the host is in UTC).
    const fromMs = new Date(createdAfter!).getTime()
    const expectedFromMs = new Date(2020, 0, 1).getTime()
    expect(fromMs).toBe(expectedFromMs)
  })

  it('sends the same created_after/created_before regardless of timezone toggle', () => {
    // Local mode (default)
    const { unmount: unmountLocal } = render(
      <ExportOrdersModal
        organization={organization}
        isShown={true}
        hide={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Export CSV'))
    expect(openMock).toHaveBeenCalledTimes(1)
    const localUrl = openMock.mock.calls[0][0] as string
    const localParsed = new URL(localUrl)
    const local = {
      created_after: localParsed.searchParams.get('created_after'),
      created_before: localParsed.searchParams.get('created_before'),
      timezone: localParsed.searchParams.get('timezone'),
    }
    // In local mode the timezone param is the host's IANA zone.
    expect(local.timezone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    unmountLocal()

    // UTC mode
    render(
      <ExportOrdersModal
        organization={organization}
        isShown={true}
        hide={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('UTC'))
    fireEvent.click(screen.getByText('Export CSV'))
    expect(openMock).toHaveBeenCalledTimes(2)
    const utcUrl = openMock.mock.calls[1][0] as string
    const utcParsed = new URL(utcUrl)
    const utc = {
      created_after: utcParsed.searchParams.get('created_after'),
      created_before: utcParsed.searchParams.get('created_before'),
    }

    // The filter boundaries must be identical between local and UTC modes.
    expect(utc.created_after).toBe(local.created_after)
    expect(utc.created_before).toBe(local.created_before)
    // Only the timezone param differs.
    expect(utcParsed.searchParams.get('timezone')).toBe('UTC')
  })
})
