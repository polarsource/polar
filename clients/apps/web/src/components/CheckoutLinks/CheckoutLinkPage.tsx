import { OrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import QrCode from '@mui/icons-material/QrCode'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useContext, useMemo, useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { toast } from '../Toast/use-toast'
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

  const [darkmode, setDarkmode] = useState<boolean>(true)
  const [embedType, setEmbedType] = useState<string>('link')

  const checkoutEmbed = useMemo(() => {
    const theme = darkmode ? 'dark' : 'light'

    return `
<a href="${checkoutLink?.url}" data-polar-checkout data-polar-checkout-theme="${theme}">Purchase</a>
<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>
  `.trim()
  }, [checkoutLink, darkmode])

  const showDarkmodeToggle = embedType === 'svg' || embedType === 'checkout'

  const triggerClassName =
    'dark:data-[state=active]:bg-polar-900 data-[state=active]:bg-white w-full rounded-full!'

  return (
    <div className="flex w-full flex-col gap-8">
      <Tabs
        defaultValue={embedType}
        onValueChange={(value) => setEmbedType(value)}
      >
        <TabsList className="dark:bg-polar-800 mb-4 w-full rounded-full bg-gray-100">
          <TabsTrigger className={triggerClassName} value="link">
            Link
          </TabsTrigger>
          <TabsTrigger className={triggerClassName} value="embed">
            Embed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <div className="flex flex-row items-center gap-x-4">
            <CopyToClipboardInput
              value={checkoutLink.url}
              buttonLabel="Copy"
              className="bg-white"
              onCopy={() => {
                toast({
                  title: 'Copied To Clipboard',
                  description: `Checkout Link was copied to clipboard`,
                })
              }}
            />
            <Button variant="secondary" onClick={showQRCodeModal}>
              <QrCode />
              <span className="ml-2">QR Code</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="embed">
          <CopyToClipboardInput
            value={checkoutEmbed}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Checkout Embed was copied to clipboard`,
              })
            }}
          />
        </TabsContent>

        {showDarkmodeToggle && (
          <div className="mt-4 flex flex-row gap-x-2">
            <Checkbox
              id="darkmode"
              checked={darkmode}
              onCheckedChange={(checked) => {
                setDarkmode(checked === true)
              }}
            />
            <Label htmlFor="darkmode" className="grow text-xs">
              Dark Mode
            </Label>
          </div>
        )}
      </Tabs>

      <CheckoutLinkForm
        checkoutLink={checkoutLink}
        organization={organization}
        onClose={() => {}}
      />

      <Modal
        title="Checkout QR Code"
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
