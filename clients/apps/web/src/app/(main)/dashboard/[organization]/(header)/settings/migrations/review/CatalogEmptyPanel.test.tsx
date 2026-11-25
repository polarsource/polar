import { fireEvent, render, screen } from '@testing-library/react'
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
      screen.getByRole('heading', { name: 'Refreshing your catalog' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(screen.getByText(/reading your catalog again/i)).toBeTruthy()
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
      screen.getByRole('button', { name: 'Refresh catalog' }),
    ).toBeEnabled()
  })

  it('lets a stalled refresh be started again', () => {
    render(
      <CatalogEmptyPanel
        kind="no_stripe_subscriptions"
        rerunning
        stalled
        onRerunPrecheck={() => undefined}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Refreshing your catalog' }),
    ).toBeTruthy()
    expect(screen.getByText(/no progress for a while/i)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Refresh catalog' }),
    ).toBeEnabled()
  })

  it('lets a merchant with only benefits continue to them', () => {
    const onContinue = vi.fn()
    render(
      <CatalogEmptyPanel
        kind="benefits_only"
        onRerunPrecheck={() => undefined}
        onContinue={onContinue}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'No subscriptions to import' }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to benefits' }),
    )
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows why continuing to benefits failed', () => {
    render(
      <CatalogEmptyPanel
        kind="benefits_only"
        onContinue={() => undefined}
        continueError="Something went wrong."
      />,
    )

    expect(
      screen.getByRole('heading', { name: "We couldn't continue to benefits" }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Continue to benefits' }),
    ).toBeEnabled()
  })
})
