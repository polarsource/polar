import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ImportedHandoff } from './ImportedHandoff'

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useStartPanTransfer: () => ({
    isPending: false,
    error: null,
    mutate: vi.fn(),
  }),
}))

vi.mock('@polar-sh/orbit', () => ({
  Text: ({
    as: Tag = 'span',
    children,
  }: {
    as?: 'span' | 'h3'
    children: ReactNode
  }) => <Tag>{children}</Tag>,
  ButtonGroup: ({
    actions,
  }: {
    actions: { text: string; disabled?: boolean }[]
  }) => (
    <>
      {actions.map((action) => (
        <button key={action.text} disabled={action.disabled}>
          {action.text}
        </button>
      ))}
    </>
  ),
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

const nothingImported = {
  imported: { products: 0, customers: 0, discounts: 0, subscriptions: 0 },
  counts: { subscriptions: { ready: 0 } },
  selectableTotal: 0,
  isLoading: false,
  isFetching: false,
  isError: false,
} as unknown as Parameters<typeof ImportedHandoff>[0]['outcome']

describe('ImportedHandoff', () => {
  it('lets a merchant with no subscriptions set up benefits', () => {
    render(
      <ImportedHandoff
        migrationId="migration"
        outcome={nothingImported}
        onReviewRecords={() => undefined}
        onSetUpBenefits={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Nothing imported' }),
    ).toBeTruthy()
    expect(screen.queryByText(/Prepare your subscriptions first/)).toBeNull()
    expect(screen.getByText(/Bring your license keys/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Set up benefits' }),
    ).toBeEnabled()
  })

  it('still sends a Stripe merchant with nothing imported back to prepare', () => {
    render(
      <ImportedHandoff
        migrationId="migration"
        outcome={nothingImported}
        onReviewRecords={() => undefined}
      />,
    )

    expect(screen.getByText(/Prepare your subscriptions first/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Start moving cards' }),
    ).toBeDisabled()
  })
})
