import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mutateAsync, environment } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  environment: { name: 'development' },
}))

vi.mock('@/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/config')>()
  return {
    ...actual,
    CONFIG: {
      ...actual.CONFIG,
      get ENVIRONMENT() {
        return environment.name
      },
    },
  }
})

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
  SegmentedControl: ({
    options,
    onChange,
  }: {
    options: { value: string; label: string }[]
    onChange: (value: string) => void
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
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
    environment.name = 'development'
  })

  it('requires Connect → Accounts Read and a test-mode key in this environment', () => {
    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Accounts')).toBeTruthy()
    expect(
      screen.getByText(/Listed under Connect/, { exact: false }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Create a restricted key in Stripe/ }),
    ).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/apikeys/create',
    )
    expect(screen.getByPlaceholderText('rk_test_...')).toBeTruthy()
    expect(
      screen.getByText(/This environment needs a test-mode key/),
    ).toBeTruthy()
  })

  it('asks for a live-mode key in production', () => {
    environment.name = 'production'
    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/This environment needs a live-mode key/),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Create a restricted key in Stripe/ }),
    ).toHaveAttribute('href', 'https://dashboard.stripe.com/apikeys/create')
    expect(screen.getByPlaceholderText('rk_live_...')).toBeTruthy()
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

  it('highlights Accounts when the API reports it missing', async () => {
    mutateAsync.mockResolvedValue({
      error: {
        error: 'MissingStripeScopes',
        detail: 'The Stripe API key is missing access to: Accounts.',
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

  it('offers Stripe and Lemon Squeezy, starting on Stripe', () => {
    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Lemon Squeezy' })).toBeTruthy()
    expect(screen.getByPlaceholderText('rk_test_...')).toBeTruthy()
  })

  it('creates a Lemon Squeezy migration with the store ID', async () => {
    const onCreated = vi.fn()
    mutateAsync.mockResolvedValue({ data: { id: 'migration_1' } })

    render(
      <CreateMigrationModal
        organizationId="org_1"
        onCreated={onCreated}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Lemon Squeezy' }))
    fireEvent.change(screen.getByPlaceholderText('Lemon Squeezy API key'), {
      target: { value: 'ls_key' },
    })
    fireEvent.change(screen.getByPlaceholderText('Store ID (optional)'), {
      target: { value: '42' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Validate & create migration/ }),
    )

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 'migration_1' })
    })
    expect(mutateAsync).toHaveBeenCalledWith({
      organization_id: 'org_1',
      source_platform: 'lemon_squeezy',
      api_key: 'ls_key',
      store_id: '42',
    })
  })
})
