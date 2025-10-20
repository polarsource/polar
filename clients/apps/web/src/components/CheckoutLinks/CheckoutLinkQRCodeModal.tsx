import Close from '@mui/icons-material/Close'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import QRCode from 'qrcode'
import { useEffect, useRef } from 'react'
import { toast } from '../Toast/use-toast'

interface CheckoutLinkQRCodeModalProps {
  checkoutLink: schemas['CheckoutLink']
  hide: () => void
}

export const CheckoutLinkQRCodeModal = ({
  checkoutLink,
  hide,
}: CheckoutLinkQRCodeModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, checkoutLink.url)
  }, [checkoutLink])

  return (
    <div className="relative flex flex-col items-center justify-center p-12">
      <Button
        variant="ghost"
        size="icon"
        onClick={hide}
        className="absolute top-6 right-6"
      >
        <Close />
      </Button>
      <div className="flex flex-col gap-8">
        <canvas ref={canvasRef} className="overflow-hidden rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Button
            fullWidth
            onClick={() => {
              const canvas = canvasRef.current
              if (!canvas) return
              const image = canvas.toDataURL('image/png')
              const link = document.createElement('a')
              link.href = image
              link.download = 'checkout-link.png'
              link.click()

              toast({
                title: 'Downloaded Image',
                description: 'Checkout link image downloaded',
              })
            }}
          >
            Download Image
          </Button>
          <Button
            fullWidth
            variant="ghost"
            onClick={() => {
              canvasRef.current?.toBlob((blob) => {
                if (!blob) return

                navigator.clipboard.write([
                  new ClipboardItem({
                    'image/png': blob,
                  }),
                ])

                toast({
                  title: 'Copied to Clipboard',
                  description: 'Checkout link image copied to clipboard',
                })
              })
            }}
          >
            Copy to Clipboard
          </Button>
        </div>
      </div>
    </div>
  )
}
