'use client'

import {
  PolarEmbedPaymentMethod,
  type EmbedPaymentMethodErrorCode,
} from '@polar-sh/checkout/payment-method'
import { useEffect } from 'react'

const MESSAGES: Record<EmbedPaymentMethodErrorCode, string> = {
  invalid_request: 'Missing required parameters.',
  unauthorized: 'Session expired.',
  processing_failed: 'Could not process the payment method. Please try again.',
  unknown: 'Something went wrong.',
}

interface Props {
  code: EmbedPaymentMethodErrorCode
  embedOrigin?: string
}

export const EmbedError = ({ code, embedOrigin }: Props) => {
  useEffect(() => {
    if (!embedOrigin) return
    PolarEmbedPaymentMethod.postMessage({ event: 'error', code }, embedOrigin)
    PolarEmbedPaymentMethod.postMessage({ event: 'loaded' }, embedOrigin)
  }, [code, embedOrigin])

  return (
    <p role="alert" className="p-4 text-center text-sm text-red-500">
      {MESSAGES[code]}
    </p>
  )
}
