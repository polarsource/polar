import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PrecheckPanel } from './PrecheckPanel'

const mutate = vi.fn()

vi.mock('@/hooks/queries/merchantMigrations', async (importOriginal) => ({
  ...(await importOriginal()),
  useRunMerchantMigrationPrecheck: () => ({
    mutate,
    isPending: false,
    isError: false,
  }),
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
  it('keeps the button disabled while the pre-check is making progress', () => {
    render(<PrecheckPanel migration={migrationWith(false)} />)

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })

  it('lets the merchant start a stalled pre-check again', () => {
    render(<PrecheckPanel migration={migrationWith(true)} />)

    expect(screen.getByText(/no progress for a while/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(mutate).toHaveBeenCalledOnce()
  })
})
