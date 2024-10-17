'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useCallback } from 'react'

interface CheckoutEmbedCloseProps {}

const CheckoutEmbedClose: React.FC<
  React.PropsWithChildren<CheckoutEmbedCloseProps>
> = () => {
  const onClose = useCallback(() => {
    window.parent.postMessage('polarCheckoutClose', '*')
  }, [])

  return (
    <button
      type="button"
      className="dark:bg-polar-950 fixed right-4 top-4 rounded-full bg-transparent bg-white p-2 shadow-xl dark:text-white"
      onClick={onClose}
    >
      <XMarkIcon className="h-6 w-6" />
    </button>
  )
}

export default CheckoutEmbedClose
