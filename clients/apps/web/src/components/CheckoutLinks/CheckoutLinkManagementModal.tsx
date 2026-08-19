import AccessRestricted from '@/components/Finance/AccessRestricted'
import { useHasPermission } from '@/hooks/permissions'
import { permissionDeniedMessage } from '@/utils/permissions'
import { schemas } from '@polar-sh/client'
import { InlineModalHeader } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CheckoutLinkForm } from './CheckoutLinkForm'

interface CheckoutLinkManagementModalProps {
  organization: schemas['Organization']
  onClose: (checkoutLink: schemas['CheckoutLink']) => void
  hide: () => void
  productIds?: string[]
  checkoutLink?: schemas['CheckoutLink']
}

export const CheckoutLinkManagementModal = ({
  organization,
  onClose,
  hide,
  productIds,
  checkoutLink,
}: CheckoutLinkManagementModalProps) => {
  const canManageProducts = useHasPermission(organization.id, 'products:manage')
  const title = checkoutLink ? 'Edit Checkout Link' : 'Create Checkout Link'

  if (!canManageProducts) {
    return (
      <Box flexDirection="column" height="100%">
        <InlineModalHeader hide={hide}>
          <h1 className="text-xl">{title}</h1>
        </InlineModalHeader>
        <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
          <AccessRestricted
            message={permissionDeniedMessage('products:manage')}
          />
        </Box>
      </Box>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h1 className="text-xl">{title}</h1>
      </InlineModalHeader>
      <div className="flex h-full flex-col gap-8 px-8 pb-12">
        <CheckoutLinkForm
          organization={organization}
          onClose={onClose}
          productIds={productIds}
          checkoutLink={checkoutLink}
        />
      </div>
    </div>
  )
}
