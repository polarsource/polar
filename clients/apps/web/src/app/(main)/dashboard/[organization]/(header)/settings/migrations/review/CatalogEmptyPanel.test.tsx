import { render, screen } from '@testing-library/react'
import { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CatalogEmptyPanel } from './CatalogEmptyPanel'

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useReconnectMerchantMigration: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@polar-sh/orbit', () => ({
  Alert: ({
    title,
    description,
  }: {
    title: string
    description?: ReactNode
  }) => (
    <div role="alert">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  ),
  Text: ({
    as: Tag = 'span',
    children,
  }: {
    as?: 'span' | 'h3'
    children: ReactNode
  }) => <Tag>{children}</Tag>,
  Button: ({
    children,
    disabled,
    type,
    asChild,
  }: {
    children: ReactNode
    disabled?: boolean
    type?: 'button' | 'submit'
    asChild?: boolean
  }) =>
    asChild ? (
      children
    ) : (
      <button type={type} disabled={disabled}>
        {children}
      </button>
    ),
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({
    children,
    as: Tag = 'div',
    onSubmit,
  }: {
    children?: ReactNode
    as?: string
    onSubmit?: (event: FormEvent) => void
  }) => {
    const Component = Tag as 'form'
    return <Component onSubmit={onSubmit}>{children}</Component>
  },
}))

describe('CatalogEmptyPanel', () => {
  it('replaces the empty result while Stripe is refreshing', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        rerunning
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Refreshing from Stripe' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(screen.getByText(/reading your Stripe catalog again/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  })

  it('shows the settled empty result when the refresh is idle', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Nothing to import' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Refresh from Stripe' }),
    ).toBeEnabled()
  })

  it('shows a failed scan instead of the empty result', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        migrationId="migration_1"
        error="The Stripe API key is missing access to: Coupons, Promotion codes."
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(screen.queryByText(/no subscriptions in Stripe/i)).toBeNull()
    expect(
      screen.getByText(
        'The Stripe API key is missing access to: Coupons, Promotion codes.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Validate & replace key' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Refresh from Stripe' }),
    ).toBeEnabled()
  })
})
