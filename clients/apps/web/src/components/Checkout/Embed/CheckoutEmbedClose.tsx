'use client'

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import type { schemas } from '@polar-sh/client'
import { X } from 'lucide-react'
import { useCallback, useEffect } from 'react'

interface CheckoutEmbedCloseProps {
  checkout: schemas['CheckoutPublic']
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

  useEffect(() => {
    const outsideClickListener = (event: MouseEvent) => {
      const contentElement = document.getElementById('polar-embed-content')
      if (contentElement && !contentElement.contains(event.target as Node)) {
        onClose()
      }
    }
    document
      .getElementById('polar-embed-layout')
      ?.addEventListener('click', outsideClickListener)

    return () => {
      document
        .getElementById('polar-embed-layout')
        ?.removeEventListener('click', outsideClickListener)
    }
  }, [onClose])

  return (
    <button
      type="button"
      className="dark:bg-polar-950 fixed top-2 right-2 cursor-pointer rounded-full bg-transparent bg-white p-2 shadow-xl md:top-4 md:right-4 dark:text-white"
      onClick={onClose}
    >
      <X className="h-4 w-4 md:h-6 md:w-6" />
    </button>
  )
}

export default CheckoutEmbedClose
