'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { CheckoutPublic } from '@polar-sh/sdk'
import { useCallback } from 'react'

interface CheckoutEmbedCloseProps {
  checkout: CheckoutPublic
}

const CheckoutEmbedClose: React.FC<
  React.PropsWithChildren<CheckoutEmbedCloseProps>
> = ({ checkout }) => {
  const onClose = useCallback(() => {
    if (!checkout.embed_origin) {
      return
    }
    PolarEmbedCheckout.postMessage({ event: 'close' }, checkout.embed_origin)
  }, [checkout])

  return (
    <button
      type="button"
      className="dark:bg-polar-950 fixed right-2 top-2 rounded-full bg-transparent bg-white p-2 shadow-xl md:right-4 md:top-4 dark:text-white"
      onClick={onClose}
    >
      <XMarkIcon className="h-4 w-4 md:h-6 md:w-6" />
    </button>
  )
}

export default CheckoutEmbedClose
