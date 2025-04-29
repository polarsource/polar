import { OrganizationContext } from '@/providers/maintainerOrganization'
import { QrCode } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useContext } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { CheckoutLinkForm } from './CheckoutLinkForm'
import { CheckoutLinkQRCodeModal } from './CheckoutLinkQRCodeModal'

interface CheckoutLinkPageProps {
  checkoutLink: schemas['CheckoutLink']
}

export const CheckoutLinkPage = ({ checkoutLink }: CheckoutLinkPageProps) => {
  const { organization } = useContext(OrganizationContext)

  const {
    isShown: isQRCodeModalOpen,
    show: showQRCodeModal,
    hide: hideQRCodeModal,
  } = useModal()

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-row justify-start gap-4">
        <CopyToClipboardInput value={checkoutLink.url} />
        <Button variant="secondary" onClick={showQRCodeModal}>
          <QrCode />
        </Button>
        <Button>Edit Metadata</Button>
      </div>
      <CheckoutLinkForm
        checkoutLink={checkoutLink}
        organization={organization}
        onClose={() => {}}
      />
      <Modal
        isShown={isQRCodeModalOpen}
        hide={hideQRCodeModal}
        modalContent={
          <CheckoutLinkQRCodeModal
            checkoutLink={checkoutLink}
            hide={hideQRCodeModal}
          />
        }
      />
    </div>
  )
}
