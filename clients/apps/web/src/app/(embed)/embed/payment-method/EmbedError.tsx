'use client'

import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { useEffect } from 'react'

type Code = 'invalid_request' | 'unauthorized' | 'unknown'

const MESSAGES: Record<Code, string> = {
  invalid_request: 'Missing required parameters.',
  unauthorized: 'Session expired.',
  unknown: 'Something went wrong.',
}

interface Props {
  code: Code
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
