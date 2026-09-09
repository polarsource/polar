import { render, screen, within } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CountEntity, EntityCount } from './recordSummary'

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
  Alert: ({
    variant,
    title,
    description,
  }: {
    variant?: string
    title: string
    description?: ReactNode
  }) => (
    <div data-testid="alert" data-variant={variant ?? 'info'}>
      <span>{title}</span>
      {description != null && <span>{description}</span>}
    </div>
  ),
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Text: ({ children, color }: { children: ReactNode; color?: string }) => (
    <span data-color={color ?? null}>{children}</span>
  ),
  DataTable: () => null,
  InlineModal: ({ isShown }: { isShown: boolean }) =>
    isShown ? <div data-testid="inline-modal" /> : null,
  SegmentedControl: () => null,
}))

vi.mock('./reviewColumns', () => ({
  buildReviewColumns: vi.fn(() => []),
}))

vi.mock('./ReviewRecordModal', () => ({
  ReviewRecordModal: () => null,
}))

const { ReviewTableView } = await import('./ReviewTableView')

const makeCount = (
  entity: CountEntity,
  overrides: Partial<EntityCount> = {},
): EntityCount => ({
  entity,
  total: 0,
  importable: 0,
  skipped: 0,
  imported: 0,
  ready: 0,
  action_required: 0,
  selectable: 0,
  ...overrides,
})

const makeCounts = (
  subscriptions: Partial<EntityCount> = {},
): Record<CountEntity, EntityCount> => ({
  subscriptions: makeCount('subscriptions', subscriptions),
  products: makeCount('products'),
  customers: makeCount('customers'),
})

const selection = { mode: 'all' as const, toggled: new Set<string>() }

const STALLED_MESSAGE =
  "The refresh from Stripe hasn't made progress. Try again to resume."

const renderView = (overrides: Record<string, unknown> = {}) =>
  render(
    <ReviewTableView
      filter="all"
      onFilterChange={() => {}}
      counts={makeCounts({ total: 5, imported: 0, selectable: 1 })}
      rows={[]}
      page={1}
      pageSize={20}
      pageCount={1}
      rowCount={0}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
      selection={selection}
      onToggle={() => {}}
      onToggleAll={() => {}}
      onImport={() => {}}
      onRerunPrecheck={() => {}}
      rerunning={false}
      attentionCount={0}
      {...overrides}
    />,
  )

describe('ReviewTableView refresh alert', () => {
  it('renders a stalled run as a warning over the review table', () => {
    renderView({
      refreshError: STALLED_MESSAGE,
      refreshErrorVariant: 'warning',
    })

    const alert = screen.getByTestId('alert')
    expect(alert.getAttribute('data-variant')).toBe('warning')
    expect(
      within(alert).getByText("The refresh from Stripe hasn't finished"),
    ).toBeTruthy()
    expect(within(alert).getByText(STALLED_MESSAGE)).toBeTruthy()
    expect(screen.queryByText('Nothing to import')).toBeNull()
  })

  it('renders a hard failure as danger when the variant is danger', () => {
    renderView({
      refreshError: 'Catalog read failed',
      refreshErrorVariant: 'danger',
    })

    const alert = screen.getByTestId('alert')
    expect(alert.getAttribute('data-variant')).toBe('danger')
    expect(
      within(alert).getByText("We couldn't refresh from Stripe"),
    ).toBeTruthy()
  })

  it('defaults to the danger variant when no variant is passed', () => {
    renderView({ refreshError: 'Catalog read failed' })

    expect(screen.getByTestId('alert').getAttribute('data-variant')).toBe(
      'danger',
    )
  })

  it('surfaces the warning above the empty-catalog panel when nothing was upserted', () => {
    renderView({
      counts: makeCounts({ total: 0, imported: 0, selectable: 0 }),
      refreshError: STALLED_MESSAGE,
      refreshErrorVariant: 'warning',
    })

    const alert = screen.getByTestId('alert')
    expect(alert.getAttribute('data-variant')).toBe('warning')
    expect(within(alert).getByText(STALLED_MESSAGE)).toBeTruthy()
    expect(screen.getByText('Nothing to import')).toBeTruthy()
  })

  it('renders no refresh alert when there is nothing to surface', () => {
    renderView()

    expect(screen.queryByTestId('alert')).toBeNull()
  })

  it('still renders a hard import error as danger', () => {
    renderView({
      refreshError: undefined,
      importError: 'Something went wrong while preparing subscriptions.',
    })

    const alert = screen.getByTestId('alert')
    expect(alert.getAttribute('data-variant')).toBe('danger')
    expect(
      within(alert).getByText("We couldn't prepare these subscriptions"),
    ).toBeTruthy()
  })
})
