import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schemas } from '@polar-sh/client'

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
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
  Spinner: () => null,
  Text: ({ children, color }: { children: ReactNode; color?: string }) => (
    <span data-color={color ?? null}>{children}</span>
  ),
}))

vi.mock('@/hooks/queries/merchantMigrations', async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import('@/hooks/queries/merchantMigrations')
  return {
    isActiveMigrationOperation: actual.isActiveMigrationOperation,
    useRunMerchantMigrationPrecheck: vi.fn(),
  }
})

const { useRunMerchantMigrationPrecheck } =
  await import('@/hooks/queries/merchantMigrations')
const { PrecheckPanel } = await import('./PrecheckPanel')

const makeOperation = (
  overrides: Partial<schemas['MerchantMigrationOperation']> = {},
): schemas['MerchantMigrationOperation'] => ({
  status: 'running',
  stalled: false,
  error: null,
  ...overrides,
})

const makeMigration = (
  operation: schemas['MerchantMigrationOperation'] | null,
): schemas['MerchantMigration'] =>
  ({
    id: 'm1',
    organization_id: 'org-1',
    source_platform: 'stripe',
    step: 'source_setup',
    source_connected: true,
    source: null,
    operation,
  }) as unknown as schemas['MerchantMigration']

const mockPrecheck = (
  overrides: Partial<ReturnType<typeof useRunMerchantMigrationPrecheck>> = {},
) =>
  vi.mocked(useRunMerchantMigrationPrecheck).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useRunMerchantMigrationPrecheck>)

const STALLED_MESSAGE =
  "The pre-check hasn't made progress. Try again to resume."

describe('PrecheckPanel', () => {
  beforeEach(() => {
    vi.mocked(useRunMerchantMigrationPrecheck).mockReset()
    mockPrecheck()
  })

  it('surfaces a stuck run as a warning and keeps retry enabled', () => {
    mockPrecheck()
    render(
      <PrecheckPanel
        migration={makeMigration(makeOperation({ stalled: true }))}
      />,
    )

    const message = screen.getByText(STALLED_MESSAGE)
    expect(message.getAttribute('data-color')).toBe('warning')
    expect(screen.queryByText('Reading your Stripe catalog…')).toBeNull()

    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button).not.toBeDisabled()
  })

  it('renders a hard failure as a danger error', () => {
    mockPrecheck()
    render(
      <PrecheckPanel
        migration={makeMigration(
          makeOperation({ status: 'failed', error: 'Stripe API unavailable' }),
        )}
      />,
    )

    const message = screen.getByText('Stripe API unavailable')
    expect(message.getAttribute('data-color')).toBe('danger')
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeDisabled()
  })

  it('shows no error text when a failed run carries no error message', () => {
    mockPrecheck()
    render(
      <PrecheckPanel
        migration={makeMigration(
          makeOperation({ status: 'failed', error: null }),
        )}
      />,
    )

    expect(screen.queryByText(/pre-check hasn't made progress/)).toBeNull()
    expect(screen.queryByText(/couldn't start the pre-check/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeDisabled()
  })

  it('shows the running state and disables retry while an operation is active', () => {
    mockPrecheck()
    render(
      <PrecheckPanel
        migration={makeMigration(
          makeOperation({ status: 'running', stalled: false }),
        )}
      />,
    )

    expect(screen.getByText('Reading your Stripe catalog…')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Checking…' })
    expect(button).toBeDisabled()
  })

  it('shows the initial state with no operation', () => {
    mockPrecheck()
    render(<PrecheckPanel migration={makeMigration(null)} />)

    expect(
      screen.getByRole('button', { name: 'Run pre-check' }),
    ).not.toBeDisabled()
    expect(screen.queryByText('Reading your Stripe catalog…')).toBeNull()
    expect(screen.queryByText(STALLED_MESSAGE)).toBeNull()
  })

  it('surfaces a mutation error as danger with the run-pre-check affordance', () => {
    mockPrecheck({
      isError: true,
      error: new Error('Network failure') as never,
    })
    render(<PrecheckPanel migration={makeMigration(null)} />)

    const message = screen.getByText(
      "We couldn't start the pre-check. Please try again.",
    )
    expect(message.getAttribute('data-color')).toBe('danger')
    expect(
      screen.getByRole('button', { name: 'Run pre-check' }),
    ).not.toBeDisabled()
  })

  it('prefers the stalled warning over a prior mutation error', () => {
    mockPrecheck({
      isError: true,
      error: new Error('Network failure') as never,
    })
    render(
      <PrecheckPanel
        migration={makeMigration(makeOperation({ stalled: true }))}
      />,
    )

    const message = screen.getByText(STALLED_MESSAGE)
    expect(message.getAttribute('data-color')).toBe('warning')
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeDisabled()
  })
})
