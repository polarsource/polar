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

const migrationWith = (stalled: boolean) =>
  ({
    id: 'migration_1',
    operation: { status: 'running', stalled },
  }) as unknown as schemas['MerchantMigration']

describe('PrecheckPanel', () => {
  beforeEach(() => {
    precheck.mutate.mockClear()
    precheck.isPending = false
    precheck.isError = false
  })

  it('keeps the button disabled while the pre-check is making progress', () => {
    render(<PrecheckPanel migration={migrationWith(false)} />)

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
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
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })
})
