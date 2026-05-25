'use client'

import {
  PolarEmbedPaymentMethod,
  type EmbedPaymentMethodErrorCode,
} from '@polar-sh/checkout/payment-method'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { useEffect } from 'react'

const ERROR_TRANSLATION_KEYS = {
  invalid_request: 'embedPaymentMethod.errors.invalidRequest',
  unauthorized: 'embedPaymentMethod.errors.unauthorized',
  processing_failed: 'embedPaymentMethod.errors.processingFailed',
  unknown: 'embedPaymentMethod.errors.unknown',
} as const satisfies Record<EmbedPaymentMethodErrorCode, string>

interface Props {
  code: EmbedPaymentMethodErrorCode
  embedOrigin?: string
  locale?: AcceptedLocale
}

export const EmbedError = ({
  code,
  embedOrigin,
  locale = DEFAULT_LOCALE,
}: Props) => {
  const t = useTranslations(locale)

  useEffect(() => {
    if (!embedOrigin) return
    PolarEmbedPaymentMethod.postMessage({ event: 'error', code }, embedOrigin)
    PolarEmbedPaymentMethod.postMessage({ event: 'loaded' }, embedOrigin)
  }, [code, embedOrigin])

  return (
    <p role="alert" className="p-4 text-center text-sm text-red-500">
      {t(ERROR_TRANSLATION_KEYS[code])}
    </p>
  )
}
