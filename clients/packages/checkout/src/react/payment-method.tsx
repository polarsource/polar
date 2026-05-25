'use client'

import { useEffect, useRef } from 'react'
import {
  PolarEmbedPaymentMethod,
  type EmbedPaymentMethodErrorCode,
  type EmbedPaymentMethodRedirectResult,
} from '../payment-method'

const POLAR_PAYMENT_METHOD_EVENT = 'POLAR_PAYMENT_METHOD'
const EMBED_PATH = '/embed/payment-method'

type IncomingMessage =
  | { event: 'loaded' }
  | { event: 'confirmed' }
  | { event: 'success'; paymentMethodId: string }
  | { event: 'error'; code: EmbedPaymentMethodErrorCode }
  | { event: 'resize'; height: number }

const isPolarMessage = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any,
): message is IncomingMessage & { type: typeof POLAR_PAYMENT_METHOD_EVENT } => {
  return (
    !!message &&
    typeof message === 'object' &&
    message.type === POLAR_PAYMENT_METHOD_EVENT
  )
}

const resolveEmbedBaseURL = (): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Defined at build time by tsup
  const origins = __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string
  return origins.split(',')[0]
}

const isAllowedOrigin = (origin: string): boolean => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Defined at build time by tsup
  return (__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string)
    .split(',')
    .includes(origin)
}

const buildIframeAllow = (): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Defined at build time by tsup
  const origins = (__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string)
    .split(',')
    .join(' ')
  return `payment 'self' ${origins}; publickey-credentials-get 'self' ${origins};`
}

interface PolarPaymentMethodBaseProps {
  /**
   * A short-lived session token returned by
   * `POST /v1/customer-sessions`. Pass whatever the API returned —
   * the SDK detects the prefix (`polar_cst_` vs `polar_mst_`) and
   * routes the request to the right endpoint internally.
   */
  sessionToken: string
  /**
   * Color scheme for the embed. Defaults to `light`.
   */
  theme?: 'light' | 'dark'
  /**
   * Whether the new card should be marked as the customer's default
   * payment method. Defaults to `true`.
   */
  setAsDefault?: boolean
  /**
   * Locale for the embed UI and Stripe Elements (e.g. `'en'`,
   * `'fr-FR'`). Unsupported locales fall back to English.
   */
  locale?: string
  /**
   * Fires once when the iframe has loaded and the form is interactive.
   */
  onLoaded?: () => void
  /**
   * Fires when the customer submits the card and Stripe processing
   * begins. Use this to disable any "close" / "cancel" actions you
   * render around the embed until `onSuccess` or `onError` fires.
   */
  onConfirmed?: () => void
  /**
   * Fires when the payment method has been attached to the customer.
   */
  onSuccess?: (paymentMethodId: string) => void
  /**
   * Fires when the iframe could not render the form (token missing,
   * expired, or rejected).
   */
  onError?: (code: EmbedPaymentMethodErrorCode) => void
  /**
   * Optional class name applied to the wrapping `div`. Use this to size
   * or position the embed.
   */
  className?: string
  /**
   * Optional inline style applied to the wrapping `div`.
   */
  style?: React.CSSProperties
}

export type PolarPaymentMethodProps = PolarPaymentMethodBaseProps

/**
 * Embeds the Polar "add payment method" form as a bare, chrome-less
 * iframe inside the parent React tree.
 *
 * The merchant is responsible for any surrounding UI (modal, sheet,
 * inline card, etc). For a one-line modal experience, use
 * `PolarEmbedPaymentMethod.create()` from `@polar-sh/checkout/payment-method`
 * instead.
 *
 * The iframe auto-resizes to its content height; you don't need to set
 * one. To constrain its width, style the wrapping `div` via `className`
 * or `style`.
 *
 * @example
 * ```tsx
 * <PolarPaymentMethod
 *   sessionToken={token}
 *   onSuccess={(id) => console.log('Attached:', id)}
 *   onError={(code) => console.error(code)}
 * />
 * ```
 */
export const PolarPaymentMethod = ({
  sessionToken,
  theme,
  setAsDefault,
  locale,
  onLoaded,
  onConfirmed,
  onSuccess,
  onError,
  className,
  style,
}: PolarPaymentMethodProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep handlers in a ref so the effect doesn't re-mount the iframe
  // every time the parent re-renders with new callback identities.
  const handlersRef = useRef({ onLoaded, onConfirmed, onSuccess, onError })
  useEffect(() => {
    handlersRef.current = { onLoaded, onConfirmed, onSuccess, onError }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const embedURL = new URL(EMBED_PATH, resolveEmbedBaseURL())
    embedURL.searchParams.set('session_token', sessionToken)
    embedURL.searchParams.set('embed', 'true')
    embedURL.searchParams.set('embed_origin', window.location.origin)
    if (theme) {
      embedURL.searchParams.set('theme', theme)
    }
    if (setAsDefault === false) {
      embedURL.searchParams.set('set_default', 'false')
    }
    if (locale) {
      embedURL.searchParams.set('locale', locale)
    }

    const iframe = document.createElement('iframe')
    iframe.src = embedURL.toString()
    iframe.style.display = 'block'
    iframe.style.width = '100%'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.colorScheme = 'auto'
    iframe.allow = buildIframeAllow()

    container.replaceChildren(iframe)

    const messageListener = ({ data, origin }: MessageEvent) => {
      if (!isAllowedOrigin(origin)) return
      if (!isPolarMessage(data)) return

      switch (data.event) {
        case 'loaded':
          handlersRef.current.onLoaded?.()
          break
        case 'confirmed':
          handlersRef.current.onConfirmed?.()
          break
        case 'success':
          handlersRef.current.onSuccess?.(data.paymentMethodId)
          break
        case 'error':
          handlersRef.current.onError?.(data.code)
          break
        case 'resize':
          iframe.style.height = `${Math.max(0, Math.ceil(data.height))}px`
          break
      }
    }

    window.addEventListener('message', messageListener)

    return () => {
      window.removeEventListener('message', messageListener)
      iframe.remove()
    }
  }, [sessionToken, theme, setAsDefault, locale])

  return <div ref={containerRef} className={className} style={style} />
}

export interface UsePaymentMethodRedirectResultOptions {
  /**
   * Called when the customer successfully added a payment method via a
   * redirect-based flow (Amazon Pay etc).
   */
  onSuccess?: () => void
  /**
   * Called when a redirect-based payment method flow failed.
   */
  onError?: () => void
  /**
   * Called with the raw result for either outcome — an alternative to
   * `onSuccess`/`onError` when a single handler is preferred.
   */
  onResult?: (result: EmbedPaymentMethodRedirectResult) => void
}

export const usePaymentMethodRedirectResult = ({
  onSuccess,
  onError,
  onResult,
}: UsePaymentMethodRedirectResultOptions): void => {
  const handledRef = useRef(false)
  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true
    const result = PolarEmbedPaymentMethod.getRedirectResult()
    if (!result) return
    onResult?.(result)
    if (result.status === 'succeeded') {
      onSuccess?.()
    } else {
      onError?.()
    }
  }, [onSuccess, onError, onResult])
}
