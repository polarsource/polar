import { schemas } from '@spaire/client'
import { CheckoutLinkForm } from './CheckoutLinkForm'

interface CheckoutLinkManagementModalProps {
  organization: schemas['Organization']
  onClose: (checkoutLink: schemas['CheckoutLink']) => void
  productIds: string[]
}

export const CheckoutLinkManagementModal = ({
  organization,
  onClose,
  productIds,
}: CheckoutLinkManagementModalProps) => {
  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl">Create Checkout Link</h1>
      </div>
      <CheckoutLinkForm
        organization={organization}
        onClose={onClose}
        productIds={productIds}
      />
    </div>
  )
}
