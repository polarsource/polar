import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mutateAsync } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}))

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useCreateMerchantMigration: () => ({
    mutateAsync,
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
  InlineModalHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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

import { CreateMigrationModal } from './CreateMigrationModal'

describe('CreateMigrationModal', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  it('requires All accounts Read and a test-mode key in this environment', () => {
    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('All accounts')).toBeTruthy()
    expect(
      screen.getByText(/under Connect in Stripe/, { exact: false }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Create a restricted key in Stripe/ }),
    ).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/apikeys/create',
    )
    expect(screen.getByPlaceholderText('rk_test_...')).toBeTruthy()
  })

  it('blocks a live key before calling the API', () => {
    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('rk_test_...'), {
      target: { value: 'rk_live_abc' },
    })

    expect(screen.getByText(/test-mode Stripe key/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Validate & create migration/ }),
    ).toBeDisabled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('highlights All accounts when the API reports it missing', async () => {
    mutateAsync.mockResolvedValue({
      error: {
        error: 'MissingStripeScopes',
        detail: 'The Stripe API key is missing access to: All accounts.',
      },
    })

    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('rk_test_...'), {
      target: { value: 'rk_test_abc' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Validate & create migration/ }),
    )

    await waitFor(() => {
      expect(screen.getByText('This key is missing permissions')).toBeTruthy()
    })
    expect(
      screen.getByText(
        'Grant the highlighted permissions and paste a new key.',
      ),
    ).toBeTruthy()
  })

  it('still shows a connection error when the API detail is blank', async () => {
    mutateAsync.mockResolvedValue({
      error: { error: 'InvalidSourceCredentials', detail: '' },
    })

    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('rk_test_...'), {
      target: { value: 'rk_test_abc' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Validate & create migration/ }),
    )

    await waitFor(() => {
      expect(screen.getByText("We couldn't connect this account")).toBeTruthy()
    })
    expect(
      screen.getByText('Please check the API key and try again.'),
    ).toBeTruthy()
  })
})
