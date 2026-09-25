import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CatalogEmptyPanel } from './CatalogEmptyPanel'

vi.mock('@polar-sh/orbit', () => ({
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
  }: {
    children: ReactNode
    disabled?: boolean
  }) => <button disabled={disabled}>{children}</button>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

  it('shows a failed Stripe read instead of an empty catalog', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        readError="The Stripe API key is missing access to: Coupons."
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: "We couldn't read your subscriptions",
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(
      screen.getByText('The Stripe API key is missing access to: Coupons.'),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Refresh from Stripe' }),
    ).toBeEnabled()
  })

  it('shows the refresh in progress while a failed read is retried', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        rerunning
        readError="The Stripe API key is missing access to: Coupons."
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Refreshing from Stripe' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', {
        name: "We couldn't read your subscriptions",
      }),
    ).toBeNull()
  })
})
