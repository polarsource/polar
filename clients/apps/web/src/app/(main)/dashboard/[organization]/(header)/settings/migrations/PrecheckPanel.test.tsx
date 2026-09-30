import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrecheckPanel } from './PrecheckPanel'

const precheck = { mutate: vi.fn(), isPending: false, isError: false }

vi.mock('@/hooks/queries/merchantMigrations', async (importOriginal) => ({
  ...(await importOriginal()),
  useRunMerchantMigrationPrecheck: () => precheck,
}))

vi.mock('@polar-sh/orbit', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Spinner: () => <span />,
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const migrationWith = (
  stalled: boolean,
  status: schemas['MerchantMigrationOperationStatus'] = 'running',
) =>
  ({
    id: 'migration_1',
    operation: { status, kind: 'precheck', stalled, error: null },
  }) as unknown as schemas['MerchantMigration']

describe('PrecheckPanel', () => {
  beforeEach(() => {
    precheck.mutate.mockClear()
    precheck.isPending = false
    precheck.isError = false
  })

  it('shows the pre-check that create started without asking for a click', () => {
    render(<PrecheckPanel migration={migrationWith(false, 'pending')} />)

    expect(screen.getByText(/reading your stripe catalog/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lets the merchant retry a failed pre-check', () => {
    render(<PrecheckPanel migration={migrationWith(false, 'failed')} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(precheck.mutate).toHaveBeenCalledOnce()
  })

  it('still starts a pre-check for a migration that never ran one', () => {
    render(
      <PrecheckPanel
        migration={
          {
            id: 'migration_1',
            operation: null,
          } as unknown as schemas['MerchantMigration']
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run pre-check' }))
    expect(precheck.mutate).toHaveBeenCalledOnce()
  })

  it('lets the merchant start a stalled pre-check again', () => {
    render(<PrecheckPanel migration={migrationWith(true)} />)

    expect(screen.getByText(/no progress for a while/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(precheck.mutate).toHaveBeenCalledOnce()
  })

  it('shows why a restart of a stalled pre-check failed', () => {
    precheck.isError = true
    render(<PrecheckPanel migration={migrationWith(true)} />)

    expect(screen.getByText(/no progress for a while/i)).toBeTruthy()
    expect(screen.getByText(/couldn't start the pre-check/i)).toBeTruthy()
  })

  it('stops offering a restart once one is on its way', () => {
    precheck.isPending = true
    render(<PrecheckPanel migration={migrationWith(true)} />)

    expect(screen.queryByText(/no progress for a while/i)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
