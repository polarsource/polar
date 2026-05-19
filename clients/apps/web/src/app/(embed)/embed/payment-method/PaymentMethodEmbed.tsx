'use client'

import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { createClient, schemas } from '@polar-sh/client'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import {
  PaymentMethodForm,
  type CustomerBillingDetails,
  type SetupIntent,
} from './PaymentMethodForm'

interface Props {
  sessionToken: string
  embedOrigin: string
  theme?: 'light' | 'dark'
  mode: 'modal' | 'inline'
  setAsDefault: boolean
  serverURL: string
  customerBillingDetails: CustomerBillingDetails
  setupIntent?: SetupIntent
}

export const PaymentMethodEmbed = ({
  sessionToken,
  embedOrigin,
  theme = 'light',
  mode,
  setAsDefault,
  serverURL,
  customerBillingDetails,
  setupIntent,
}: Props) => {
  const themePreset = useMemo(() => getThemePreset(theme), [theme])
  const api = useMemo(
    () => createClient(serverURL, sessionToken),
    [serverURL, sessionToken],
  )

  useEffect(() => {
    PolarEmbedPaymentMethod.postMessage({ event: 'loaded' }, embedOrigin)
  }, [embedOrigin])

  useEffect(() => {
    if (mode !== 'inline') return

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0
      PolarEmbedPaymentMethod.postMessage(
        { event: 'resize', height },
        embedOrigin,
      )
    })
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [mode, embedOrigin])

  const handleClose = useCallback(() => {
    PolarEmbedPaymentMethod.postMessage({ event: 'close' }, embedOrigin)
  }, [embedOrigin])

  const handleProcessingStart = useCallback(() => {
    PolarEmbedPaymentMethod.postMessage({ event: 'confirmed' }, embedOrigin)
  }, [embedOrigin])

  const handleSuccess = useCallback(
    (paymentMethod: schemas['CustomerPaymentMethod']) => {
      PolarEmbedPaymentMethod.postMessage(
        { event: 'success', paymentMethodId: paymentMethod.id },
        embedOrigin,
      )
    },
    [embedOrigin],
  )

  useEffect(() => {
    if (mode !== 'modal') return

    const handleOutsideClick = (event: MouseEvent) => {
      const content = document.getElementById('polar-embed-content')
      if (content && !content.contains(event.target as Node)) {
        handleClose()
      }
    }
    const layout = document.getElementById('polar-embed-layout')
    layout?.addEventListener('click', handleOutsideClick)
    return () => layout?.removeEventListener('click', handleOutsideClick)
  }, [mode, handleClose])

  const form = (
    <PaymentMethodForm
      api={api}
      themePreset={themePreset}
      setAsDefault={setAsDefault}
      customerBillingDetails={customerBillingDetails}
      onProcessingStart={handleProcessingStart}
      onPaymentMethodAdded={handleSuccess}
      setupIntent={setupIntent}
    />
  )

  if (mode === 'inline') {
    return <div className={theme === 'dark' ? 'dark' : 'light'}>{form}</div>
  }

  return (
    <div
      className={theme === 'dark' ? 'dark' : 'light'}
      id="polar-embed-layout"
    >
      <div className="flex h-full w-full items-center justify-center p-0 md:p-12 dark:text-white">
        <div
          className="dark:bg-polar-900 h-full w-full max-w-lg overflow-y-auto rounded-none bg-white p-8 md:h-auto md:rounded-2xl"
          id="polar-embed-content"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium">Add payment method</h2>
          </div>
          {form}
        </div>
      </div>
      <button
        type="button"
        className="dark:bg-polar-950 fixed top-2 right-2 cursor-pointer rounded-full bg-white p-2 shadow-xl md:top-4 md:right-4 dark:text-white"
        onClick={handleClose}
        aria-label="Close"
      >
        <X className="h-4 w-4 md:h-6 md:w-6" />
      </button>
    </div>
  )
}
