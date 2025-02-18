import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useMemo, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { CheckoutLinkForm } from './CheckoutLinkForm'

export interface CheckoutLinkContextViewProps {
  organization: schemas['Organization']
  checkoutLink: schemas['CheckoutLink']
  onUpdate: (checkoutLink: schemas['CheckoutLink']) => void
}

export const CheckoutLinkContextView = ({
  organization,
  checkoutLink,
  onUpdate,
}: CheckoutLinkContextViewProps) => {
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
    'dark:data-[state=active]:bg-polar-900 data-[state=active]:bg-white w-full'

  return (
    <div className="flex flex-col gap-y-8 px-8 py-12">
      <h2 className="text-lg font-medium">
        {checkoutLink.label ? checkoutLink.label : 'Unlabeled Link'}
      </h2>

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
        organization={organization}
        checkoutLink={checkoutLink}
        onClose={onUpdate}
      />
    </div>
  )
}
