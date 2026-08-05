import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// Force a non-UTC host timezone for the duration of this suite. The original
// bug (`toUTCBoundary`) only manifests when the host's UTC offset is non-zero:
// it reinterpreted local date components as UTC components, shifting the
// instant by the offset. In a UTC host the bug is invisible because local and
// UTC components coincide, so we pin the timezone to make the regression
// guards deterministic across developer machines and CI.
const originalTZ = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/New_York'
})
afterAll(() => {
  process.env.TZ = originalTZ
})

vi.mock('@/utils/api', () => ({
  getServerURL: (path: string) => `https://api.test${path}`,
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  InlineModal: ({
    isShown,
    modalContent,
  }: {
    isShown: boolean
    modalContent: ReactNode
  }) => (isShown ? <div>{modalContent}</div> : null),
  InlineModalHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ListItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SegmentedControl: ({
    options,
    onChange,
  }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (value: string) => void
  }) => (
    <div>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-testid={`seg-${opt.value}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

let setRange: ((range: { from: Date; to: Date }) => void) | undefined
vi.mock('@/components/Metrics/DateRangePicker', () => ({
  default: ({
    onDateChange,
  }: {
    onDateChange: (range: { from: Date; to: Date }) => void
  }) => {
    setRange = onDateChange
    return null
  },
}))

vi.mock('./ExportSubscriptionsColumns', () => ({
  ALL_EXPORT_COLUMNS: ['email', 'started_at'],
  DEFAULT_EXPORT_COLUMNS: ['email', 'started_at'],
  sortExportColumns: (columns: string[]) => columns,
  summarizeExportColumns: () => 'summary',
}))

const { default: ExportSubscriptionsModal } =
  await import('./ExportSubscriptionsModal')

const organization = {
  id: 'org-1',
  created_at: '2020-01-01T00:00:00Z',
} as Parameters<typeof ExportSubscriptionsModal>[0]['organization']

const exportWithRange = (
  container: HTMLElement,
  from: Date,
  to: Date,
  timezone: 'local' | 'utc',
) => {
  act(() => setRange?.({ from, to }))
  act(() =>
    container
      .querySelector<HTMLButtonElement>(`[data-testid="seg-${timezone}"]`)!
      .click(),
  )
  act(() => {
    ;(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent?.includes('Export CSV'))!
      .click()
  })
}

describe('ExportSubscriptionsModal', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setRange = undefined
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    openSpy.mockRestore()
  })

  it('does not shift boundaries when UTC timezone is selected (negative offset, UTC-4)', () => {
    const { container } = render(
      <ExportSubscriptionsModal
        organization={organization}
        status="any"
        isShown={true}
        hide={() => {}}
      />,
    )
    // User in America/New_York (UTC-4) selects June 15 midnight local, which
    // is the instant 2024-06-15T04:00:00Z.
    exportWithRange(
      container,
      new Date('2024-06-15T04:00:00Z'),
      new Date('2024-06-16T04:00:00Z'),
      'utc',
    )

    const url = openSpy.mock.calls[0][0] as URL
    // Regression guard: `toUTCBoundary` extracted local components and fed them
    // to `new UTCDate(...)`, producing 2024-06-15T00:00:00Z — 4 hours too early,
    // incorrectly including subscriptions from the previous evening.
    expect(url.searchParams.get('started_after')).toBe(
      '2024-06-15T04:00:00.000Z',
    )
    expect(url.searchParams.get('started_before')).toBe(
      '2024-06-16T04:00:00.000Z',
    )
    expect(url.searchParams.get('timezone')).toBe('UTC')
  })

  it('does not shift boundaries when UTC timezone is selected (positive offset, UTC+9)', () => {
    const { container } = render(
      <ExportSubscriptionsModal
        organization={organization}
        status="any"
        isShown={true}
        hide={() => {}}
      />,
    )
    const prevTZ = process.env.TZ
    process.env.TZ = 'Asia/Tokyo'
    try {
      exportWithRange(
        container,
        new Date('2024-06-14T15:00:00Z'),
        new Date('2024-06-15T15:00:00Z'),
        'utc',
      )
    } finally {
      process.env.TZ = prevTZ
    }

    const url = openSpy.mock.calls[0][0] as URL
    // Regression guard: the bug would have moved the boundary to
    // 2024-06-15T00:00:00Z (9h later), incorrectly excluding subscriptions from
    // the early morning of the selected day.
    expect(url.searchParams.get('started_after')).toBe(
      '2024-06-14T15:00:00.000Z',
    )
    expect(url.searchParams.get('started_before')).toBe(
      '2024-06-15T15:00:00.000Z',
    )
  })

  it('forwards the local IANA timezone param when local tz is selected', () => {
    const { container } = render(
      <ExportSubscriptionsModal
        organization={organization}
        status="any"
        isShown={true}
        hide={() => {}}
      />,
    )
    exportWithRange(
      container,
      new Date('2024-06-15T00:00:00Z'),
      new Date('2024-06-16T00:00:00Z'),
      'local',
    )

    const url = openSpy.mock.calls[0][0] as URL
    // The server uses this purely for CSV date formatting, not for altering
    // filter boundaries.
    expect(url.searchParams.get('timezone')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
  })
})
