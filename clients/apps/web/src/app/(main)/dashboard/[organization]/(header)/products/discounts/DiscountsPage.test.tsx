import {
  act,
  fireEvent,
  getByText,
  render,
  waitFor,
} from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Discount = {
  id: string
  organization_id: string
  name: string
  type: 'percentage' | 'fixed'
  basis_points?: number | null
  amount?: number | null
  currency?: string | null
  code: string | null
  redemptions_count: number
  max_redemptions?: number | null
  max_redemptions_per_customer?: number | null
  starts_at?: string | null
  ends_at?: string | null
  duration: 'forever' | 'repeating' | 'once'
  duration_in_months?: number | null
  created_at: string
  modified_at?: string | null
  archived_at?: string | null
  metadata?: Record<string, unknown>
  custom_field_data?: Record<string, unknown>
  products: string[]
}

const discount: Discount = {
  id: 'discount-1',
  organization_id: 'org-1',
  name: 'Summer Sale',
  type: 'percentage',
  basis_points: 1500,
  amount: null,
  currency: null,
  code: 'SUMMER15',
  redemptions_count: 3,
  max_redemptions: null,
  max_redemptions_per_customer: null,
  starts_at: null,
  ends_at: null,
  duration: 'forever',
  duration_in_months: null,
  created_at: '2025-01-01T00:00:00Z',
  modified_at: null,
  archived_at: null,
  metadata: {},
  custom_field_data: {},
  products: [],
}

const deleteDiscountMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/queries', () => ({
  useDeleteDiscount: () => deleteDiscountMock,
  useDiscounts: () => ({
    data: {
      items: [discount],
      pagination: { total_count: 1, max_page: 1 },
    },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/utils', () => ({
  useDebouncedCallback: (cb: unknown) => cb,
}))

vi.mock('@/components/Modal/useModal', () => ({
  useModal: () => ({
    isShown: true,
    hide: vi.fn(),
    toggle: vi.fn(),
  }),
}))

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/Toast/use-toast', () => ({
  toast: toastMock,
}))

const confirmModalMock = vi.hoisted(() => ({
  onConfirm: undefined as (() => void | Promise<void>) | undefined,
}))
vi.mock('@/components/Modal/ConfirmModal', () => ({
  ConfirmModal: ({ onConfirm }: { onConfirm: () => void | Promise<void> }) => {
    confirmModalMock.onConfirm = onConfirm
    return (
      <button data-testid="confirm-modal-confirm" onClick={() => onConfirm()}>
        Delete
      </button>
    )
  },
}))

vi.mock('@/components/Discounts/CreateDiscountModalContent', () => ({
  default: () => null,
}))
vi.mock('@/components/Discounts/UpdateDiscountModalContent', () => ({
  default: () => null,
}))
vi.mock('@/components/Layout/DashboardLayout', () => ({
  DashboardBody: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('@polar-sh/orbit', () => ({
  InlineModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
  DataTable: ({
    columns,
    data,
  }: {
    columns: {
      id?: string
      cell: (ctx: { row: { original: Discount } }) => ReactNode
    }[]
    data: Discount[]
  }) => {
    const actionsCol = columns.find((c) => c.id === 'actions')
    return (
      <div data-testid="data-table">
        {actionsCol && data.length > 0
          ? actionsCol.cell({ row: { original: data[0] } })
          : null}
      </div>
    )
  },
  DataTableColumnHeader: () => null,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock('@mui/icons-material/AddOutlined', () => ({ default: () => null }))
vi.mock('@mui/icons-material/MoreVertOutlined', () => ({ default: () => null }))
vi.mock('@mui/icons-material/Search', () => ({ default: () => null }))

vi.mock('@polar-sh/ui/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock('@polar-sh/ui/components/atoms/FormattedDateTime', () => ({
  default: () => null,
}))

const organization = {
  id: 'org-1',
  slug: 'acme',
} as Parameters<typeof ClientPage>[0]['organization']

const pagination = { pageIndex: 0, pageSize: 10 }
const sorting = [{ id: 'name', desc: false }]

const { default: ClientPage } = await import('./DiscountsPage')

const renderPage = () =>
  render(
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      query={undefined}
    />,
  )

describe('DiscountsPage delete error feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteDiscountMock.mutateAsync.mockReset()
    confirmModalMock.onConfirm = undefined
  })

  const selectDiscountAndConfirm = (container: HTMLElement) => {
    fireEvent.click(getByText(container, 'Delete Discount'))
    expect(confirmModalMock.onConfirm).toBeDefined()
    act(() => {
      confirmModalMock.onConfirm!()
    })
  }

  it('shows an error toast (and no success toast) when the delete mutation returns an error', async () => {
    deleteDiscountMock.mutateAsync.mockResolvedValue({
      data: null,
      error: { detail: "You don't have permission to manage products" },
    })

    const { container } = renderPage()
    selectDiscountAndConfirm(container)

    await waitFor(() =>
      expect(deleteDiscountMock.mutateAsync).toHaveBeenCalledTimes(1),
    )
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Discount Deletion Failed',
      description:
        "Error deleting discount Summer Sale: You don't have permission to manage products",
    })
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Discount Deleted' }),
    )
  })

  it('shows a success toast and no error toast when deletion succeeds', async () => {
    deleteDiscountMock.mutateAsync.mockResolvedValue({
      data: {},
      error: null,
    })

    const { container } = renderPage()
    selectDiscountAndConfirm(container)

    await waitFor(() =>
      expect(deleteDiscountMock.mutateAsync).toHaveBeenCalledTimes(1),
    )
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Discount Deleted',
      description: 'Discount Summer Sale successfully deleted',
    })
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Discount Deletion Failed' }),
    )
  })
})
