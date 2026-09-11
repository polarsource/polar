import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { schemas } from '@polar-sh/client'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}))

const toastMock = vi.hoisted(() => vi.fn())

const updateCheckout = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => routerState,
}))

vi.mock('@/hooks/queries', () => ({
  useCreateCheckoutLink: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateCheckoutLink: vi.fn(() => ({
    mutateAsync: updateCheckout.mutateAsync,
    isPending: false,
  })),
  useDiscount: vi.fn(() => ({})),
  useDiscounts: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useSelectedProducts: vi.fn(() => ({ data: undefined })),
}))

vi.mock('../Toast/use-toast', () => ({ toast: toastMock }))

vi.mock('@/utils/api/errors', () => ({
  normalizeValidationErrors: (errors: unknown) => errors,
  setValidationErrors: vi.fn(),
}))

vi.mock('@/utils/discount', () => ({
  getDiscountDisplay: vi.fn(() => ''),
}))

vi.mock('@polar-sh/client', () => ({
  isValidationError: () => false,
  schemas: {},
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({
    children,
    loading: _loading,
    variant: _variant,
    size: _size,
    ...rest
  }: {
    children: ReactNode
    loading?: unknown
    variant?: unknown
    size?: unknown
  } & ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...rest}>{children}</button>
  ),
  Input: ({
    ref: _ref,
    ...rest
  }: InputHTMLAttributes<HTMLInputElement> & { ref?: unknown }) => (
    <input {...rest} />
  ),
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  } & InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...rest}
    />
  ),
}))

vi.mock('@polar-sh/ui/components/ui/form', async () => {
  const { FormProvider, Controller } = await import('react-hook-form')
  const Passthrough = ({ children }: PropsWithChildren) => children
  return {
    Form: FormProvider,
    FormControl: Passthrough,
    FormDescription: () => null,
    FormField: Controller,
    FormItem: Passthrough,
    FormLabel: Passthrough,
    FormMessage: () => null,
  }
})

vi.mock('@polar-sh/ui/components/atoms/Combobox', () => ({
  Combobox: () => null,
}))

vi.mock('../Products/ProductSelect', () => ({
  default: () => null,
}))

vi.mock('@/components/Metadata/MetadataForm', () => ({
  MetadataForm: () => null,
}))

vi.mock('../TrialConfiguration/TrialConfigurationForm', () => ({
  TrialConfigurationForm: () => null,
}))

vi.mock('./CheckoutLinkSeatsField', () => ({
  CheckoutLinkSeatsField: () => null,
}))

const { CheckoutLinkForm } = await import('./CheckoutLinkForm')

type CheckoutLink = schemas['CheckoutLink']
type Organization = schemas['Organization']

const organization = { id: 'org_1', name: 'Acme' } as unknown as Organization

const makeCheckoutLink = (id: string, label: string): CheckoutLink =>
  ({
    id,
    label,
    metadata: {},
    products: [{ id: 'p1', name: 'Product One' }],
    allow_discount_codes: true,
    require_billing_address: false,
    success_url: null,
    return_url: null,
    discount_id: null,
    seats: null,
    payment_processor: 'stripe',
    organization_id: organization.id,
    url: `https://polar.sh/checkout/${id}`,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
  }) as unknown as CheckoutLink

const getLabelInput = () =>
  document.querySelector('input[name="label"]') as HTMLInputElement

const changeLabel = (value: string) => {
  fireEvent.change(getLabelInput(), { target: { value } })
}

describe('CheckoutLinkForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCheckout.mutateAsync.mockResolvedValue({
      data: makeCheckoutLink('cl_1', 'Original'),
      error: undefined,
    })
  })

  it('preserves in-progress edits when the checkoutLink prop reference changes but its id stays the same', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'Original')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('Original'))

    changeLabel('Edited')
    await waitFor(() => expect(getLabelInput()).toHaveValue('Edited'))

    rerender(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'Original')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('Edited'))
    expect(routerState.refresh).not.toHaveBeenCalled()
  })

  it('resets the form when navigating to a different checkout link id', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'A-label')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('A-label'))

    changeLabel('Edited')
    await waitFor(() => expect(getLabelInput()).toHaveValue('Edited'))

    rerender(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_2', 'B-label')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('B-label'))
  })

  it('hydrates the form when a checkoutLink first arrives after rendering in create mode', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <CheckoutLinkForm organization={organization} onClose={onClose} />,
    )

    expect(getLabelInput()).toHaveValue('')

    rerender(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'Original')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('Original'))
  })

  it('keeps edits made after a successful save when router.refresh re-renders the form with a refreshed checkoutLink', async () => {
    const updated = makeCheckoutLink('cl_1', 'Original')
    updateCheckout.mutateAsync.mockResolvedValue({
      data: updated,
      error: undefined,
    })

    const onClose = vi.fn()
    const { rerender } = render(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'Original')}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save Link' }))

    await waitFor(() => expect(routerState.refresh).toHaveBeenCalledTimes(1))
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith(updated)

    changeLabel('PostSaveEdit')
    await waitFor(() => expect(getLabelInput()).toHaveValue('PostSaveEdit'))

    rerender(
      <CheckoutLinkForm
        organization={organization}
        checkoutLink={makeCheckoutLink('cl_1', 'Original')}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getLabelInput()).toHaveValue('PostSaveEdit'))
    expect(routerState.refresh).toHaveBeenCalledTimes(1)
  })
})
