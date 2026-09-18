import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SwitchPanelView } from './SwitchPanelView'
import type { SwitchRow } from './switchRows'

vi.mock('@/components/Modal/ConfirmModal', () => ({
  ConfirmModal: () => null,
}))

vi.mock('@polar-sh/orbit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@polar-sh/orbit')>()
  return {
    ...actual,
    DataTable: ({ columns }: { columns: { id?: string }[] }) => (
      <div data-testid="column-ids">{columns.map((c) => c.id).join(',')}</div>
    ),
    InlineModal: () => null,
  }
})

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

const report = {
  started: true,
  running: false,
  completed: true,
  total: 2,
  pending: 1,
  moved: 1,
  skipped: 0,
  failed: 0,
}

const row = {
  record_id: 'rec_1',
  entity: 'subscriptions',
  source_id: 'sub_1',
  title: 'ada@example.com',
  subtitle: null,
  product_name: null,
  customer_email: 'ada@example.com',
  customer_country: null,
  amount: 2900,
  currency: 'usd',
  recurring_interval: 'month',
  reason: null,
  reason_code: null,
  reason_level: null,
  import_status: 'imported',
  cutover_status: null,
  cutover_error: null,
  renews_at: null,
  has_payment_method: true,
  dependencies_imported: null,
} as SwitchRow

const viewProps = {
  report,
  filter: 'all' as const,
  onFilterChange: () => {},
  rows: [row],
  page: 1,
  pageSize: 20,
  pageCount: 1,
  rowCount: 1,
  onPageChange: () => {},
  onPageSizeChange: () => {},
  selection: { mode: 'none' as const, toggled: new Set<string>() },
  switchCount: 0,
  canSelectAll: true,
  onToggle: () => {},
  onToggleAll: () => {},
  onSwitch: () => {},
  switching: false,
}

describe('SwitchPanelView', () => {
  it('lets the merchant pick rows while the switch is open', () => {
    render(<SwitchPanelView {...viewProps} />)

    expect(
      screen.getByRole('button', { name: 'Switch subscriptions' }),
    ).toBeTruthy()
    expect(screen.getByTestId('column-ids').textContent).toContain('select')
  })

  it('hides selection and the switch action when locked', () => {
    render(<SwitchPanelView {...viewProps} locked />)

    expect(
      screen.queryByRole('button', { name: 'Switch subscriptions' }),
    ).toBeNull()
    expect(screen.getByTestId('column-ids').textContent).not.toContain('select')
  })
})
