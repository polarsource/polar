import { schemas } from '@polar-sh/client'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import FileCopyOutlined from '@mui/icons-material/FileCopyOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import IntegrationInstructionsOutlined from '@mui/icons-material/IntegrationInstructionsOutlined'
import InventoryOutlined from '@mui/icons-material/InventoryOutlined'
import ShareOutlined from '@mui/icons-material/ShareOutlined'

export type QuickAction = {
  id: string
  title: string
  url?: string
  icon: React.ReactNode
  keywords?: string[]
  action?: () => void | Promise<void>
  destructive?: boolean
}

type SelectedItem =
  | { type: 'product'; data: schemas['Product'] }
  | { type: 'order'; data: schemas['Order'] }
  | { type: 'customer'; data: schemas['Customer'] }
  | { type: 'subscription'; data: schemas['Subscription'] }
  | null

export const getQuickActions = (organizationSlug: string): QuickAction[] => [
  {
    id: 'create-product',
    title: 'Create Product',
    url: `/dashboard/${organizationSlug}/products/new`,
    icon: <HiveOutlined fontSize="inherit" />,
    keywords: ['new', 'add', 'product'],
  },
]

export const getContextualActions = (
  organizationSlug: string,
  pageType: string,
  selectedItem: SelectedItem,
): QuickAction[] => {
  const actions: QuickAction[] = []

  // Page-specific actions (when no item selected)
  if (!selectedItem) {
    switch (pageType) {
      case 'products':
        actions.push({
          id: 'new-product',
          title: 'New Product',
          url: `/dashboard/${organizationSlug}/products/new`,
          icon: <HiveOutlined fontSize="inherit" />,
          keywords: ['create', 'add', 'new'],
        })
        break
      case 'orders':
        // Orders don't have a create action typically
        break
      case 'customers':
        // Could add customer-specific actions
        break
    }
    return actions
  }

  // Item-specific actions
  switch (selectedItem.type) {
    case 'product': {
      const product = selectedItem.data
      actions.push(
        {
          id: 'copy-product-id',
          title: 'Copy Product ID',
          icon: <ContentCopyOutlined fontSize="inherit" />,
          action: () => {
            navigator.clipboard.writeText(product.id)
          },
        },
        {
          id: 'share-product',
          title: 'Share Product',
          url: `/dashboard/${organizationSlug}/products/checkout-links?productId=${product.id}`,
          icon: <ShareOutlined fontSize="inherit" />,
        },
        {
          id: 'integrate-checkout',
          title: 'Integrate Checkout',
          url: `/dashboard/${organizationSlug}/onboarding/integrate?productId=${product.id}`,
          icon: <IntegrationInstructionsOutlined fontSize="inherit" />,
        },
      )

      if (!product.is_archived) {
        actions.push({
          id: 'edit-product',
          title: 'Edit Product',
          url: `/dashboard/${organizationSlug}/products/${product.id}/edit`,
          icon: <EditOutlined fontSize="inherit" />,
        })
      }

      actions.push({
        id: 'duplicate-product',
        title: 'Duplicate Product',
        url: `/dashboard/${organizationSlug}/products/new?fromProductId=${product.id}`,
        icon: <FileCopyOutlined fontSize="inherit" />,
      })

      if (!product.is_archived) {
        actions.push({
          id: 'archive-product',
          title: 'Archive Product',
          icon: <InventoryOutlined fontSize="inherit" />,
          destructive: true,
          action: () => {
            // This will be handled by the parent component
            // by dispatching a custom event or callback
            window.dispatchEvent(
              new CustomEvent('archive-product', { detail: product }),
            )
          },
        })
      }
      break
    }

    case 'order': {
      const order = selectedItem.data
      actions.push({
        id: 'copy-order-id',
        title: 'Copy Order ID',
        icon: <ContentCopyOutlined fontSize="inherit" />,
        action: () => {
          navigator.clipboard.writeText(order.id)
        },
      })
      break
    }

    case 'customer': {
      const customer = selectedItem.data
      actions.push(
        {
          id: 'copy-customer-id',
          title: 'Copy Customer ID',
          icon: <ContentCopyOutlined fontSize="inherit" />,
          action: () => {
            navigator.clipboard.writeText(customer.id)
          },
        },
        {
          id: 'copy-customer-email',
          title: 'Copy Email',
          icon: <ContentCopyOutlined fontSize="inherit" />,
          action: () => {
            navigator.clipboard.writeText(customer.email)
          },
        },
      )
      break
    }
  }

  return actions
}
