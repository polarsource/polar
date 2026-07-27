import { schemas } from '@polar-sh/client'
import { InlineModalHeader } from '@polar-sh/orbit'
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
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h1 className="text-xl">
          {checkoutLink ? 'Edit Checkout Link' : 'Create Checkout Link'}
        </h1>
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
