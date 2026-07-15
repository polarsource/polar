const POLAR_PAYMENT_METHOD_EVENT = 'POLAR_PAYMENT_METHOD'
const EMBED_PATH = '/embed/payment-method'

const REDIRECT_STATUS_PARAM = 'polar_payment_method_status'

/**
 * Message sent to the parent window when the embedded payment method
 * iframe is fully loaded and ready for input.
 */
interface EmbedPaymentMethodMessageLoaded {
  event: 'loaded'
}

/**
 * Message sent to the parent window when the embed should be closed
 * (X button, outside click, or programmatically).
 */
interface EmbedPaymentMethodMessageClose {
  event: 'close'
}

/**
 * Message sent to the parent window when the customer's card has been
 * submitted and Stripe processing has started.
 *
 * Once received, the parent shouldn't allow the embed to be closed
 * until `success` or `error` follows.
 */
interface EmbedPaymentMethodMessageConfirmed {
  event: 'confirmed'
}

/**
 * Message sent to the parent window when the payment method has been
 * successfully attached to the customer.
 */
interface EmbedPaymentMethodMessageSuccess {
  event: 'success'
  paymentMethodId: string
}

/**
 * Failure modes the embed surfaces via the `error` event.
 *
 * - `invalid_request`: required URL params missing or malformed.
 * - `unauthorized`: session token missing, expired, or rejected.
 * - `processing_failed`: card declined, 3DS challenge failed, or
 *   the customer-portal API rejected the new payment method.
 * - `unknown`: catch-all for unexpected server errors.
 */
export type EmbedPaymentMethodErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'processing_failed'
  | 'unknown'

/**
 * Outcome of a redirect-based payment method flow, surfaced on the
 * merchant's page once the customer is returned from the provider.
 */
export interface EmbedPaymentMethodRedirectResult {
  status: 'succeeded' | 'failed'
}

/**
 * Message sent to the parent window when the iframe can't render the
 * form or the payment-method flow fails.
 *
 * After a failure during the flow, the SDK re-enables closing the modal
 * so the customer can dismiss it and try again.
 */
interface EmbedPaymentMethodMessageError {
  event: 'error'
  code: EmbedPaymentMethodErrorCode
}

/**
 * Internal: iframe announces its current content height. Consumed by
 * inline embeds to keep the iframe sized to its content. Not exposed to
 * consumers.
 */
interface EmbedPaymentMethodMessageResize {
  event: 'resize'
  height: number
}

type EmbedPaymentMethodMessage =
  | EmbedPaymentMethodMessageLoaded
  | EmbedPaymentMethodMessageClose
  | EmbedPaymentMethodMessageConfirmed
  | EmbedPaymentMethodMessageSuccess
  | EmbedPaymentMethodMessageError
  | EmbedPaymentMethodMessageResize

const isEmbedPaymentMethodMessage = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any,
): message is EmbedPaymentMethodMessage => {
  return message.type === POLAR_PAYMENT_METHOD_EVENT
}

interface EmbedPaymentMethodCreateOptions {
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
   * Where to return the customer after a redirect-based payment method
   */
  returnUrl?: string
  /**
   * Locale for the embed UI and Stripe Elements (e.g. `'en'`,
   * `'fr-FR'`). Unsupported locales fall back to English.
   */
  locale?: string
  /**
   * Convenience callback fired once when the embed has loaded.
   */
  onLoaded?: (event: CustomEvent<EmbedPaymentMethodMessageLoaded>) => void
}

interface EmbedPaymentMethodCreateInlineOptions {
  /**
   * A short-lived session token returned by
   * `POST /v1/customer-sessions`. Pass whatever the API returned —
   * the SDK detects the prefix (`polar_cst_` vs `polar_mst_`) and
   * routes the request to the right endpoint internally.
   */
  sessionToken: string
  /**
   * The element the chrome-less embed iframe is mounted into. Any
   * existing children of the element are replaced.
   */
  element: HTMLElement
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
   * BCP47 locale for the embed UI and Stripe Elements (e.g. `'en'`,
   * `'fr-FR'`). Unsupported locales fall back to English. Defaults to
   * the merchant's English copy.
   */
  locale?: string
  /**
   * Convenience callback fired once when the embed has loaded.
   */
  onLoaded?: (event: CustomEvent<EmbedPaymentMethodMessageLoaded>) => void
}

const resolveEmbedBaseURL = (): string => {
  const origins = // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Defined at build time by tsup
    (__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string).split(',')

  if (
    typeof window !== 'undefined' &&
    origins.includes(window.location.origin)
  ) {
    return window.location.origin
  }
  return origins[0]
}

const buildIframeAllow = (): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Defined at build time by tsup
  const origins = (__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string)
    .split(',')
    .join(' ')
  return `payment 'self' ${origins}; publickey-credentials-get 'self' ${origins};`
}

/**
 * An embedded payment method instance.
 *
 * Create one as a full-screen modal overlay with `create()`, or mounted
 * inline into an element you control with `createInline()`.
 */
class EmbedPaymentMethod {
  private iframe: HTMLIFrameElement
  private mode: 'modal' | 'inline'
  private loader: HTMLDivElement | null
  private loaded: boolean
  private closable: boolean
  private eventTarget: EventTarget
  private windowMessageListener: (event: MessageEvent) => void

  public constructor(
    iframe: HTMLIFrameElement,
    mode: 'modal' | 'inline',
    loader: HTMLDivElement | null,
  ) {
    this.iframe = iframe
    this.mode = mode
    this.loader = loader
    this.loaded = false
    this.closable = true
    this.eventTarget = new EventTarget()
    this.windowMessageListener = this.handleWindowMessage.bind(this)
    window.addEventListener('message', this.windowMessageListener)
  }

  /**
   * Send a message from the iframe to the parent window.
   *
   * Used internally by the Polar-hosted iframe page; not normally called
   * by SDK consumers.
   */
  public static postMessage(
    message: EmbedPaymentMethodMessage,
    targetOrigin: string,
  ): void {
    window.parent.postMessage(
      { ...message, type: POLAR_PAYMENT_METHOD_EVENT },
      targetOrigin,
    )
  }

  /**
   * Create a new full-screen modal embed.
   *
   * @example
   * ```ts
   * const embed = await PolarEmbedPaymentMethod.create({
   *   sessionToken: 'polar_cst_xxx',
   *   theme: 'dark',
   * })
   *
   * embed.addEventListener('success', (event) => {
   *   console.log('Attached:', event.detail.paymentMethodId)
   * })
   * ```
   */
  public static create(
    options: EmbedPaymentMethodCreateOptions,
  ): Promise<EmbedPaymentMethod> {
    const { sessionToken, theme, setAsDefault, returnUrl, locale, onLoaded } =
      options

    const styleSheet = document.createElement('style')
    styleSheet.innerText = `
      .polar-loader-spinner {
        width: 20px;
        aspect-ratio: 1;
        border-radius: 50%;
        background: ${theme === 'dark' ? '#000' : '#fff'};
        box-shadow: 0 0 0 0 ${theme === 'dark' ? '#fff' : '#000'};
        animation: polar-loader-spinner-animation 1s infinite;
      }
      @keyframes polar-loader-spinner-animation {
        100% {box-shadow: 0 0 0 30px #0000}
      }
      body.polar-no-scroll {
        overflow: hidden;
      }
    `
    document.head.appendChild(styleSheet)

    const loader = document.createElement('div')
    loader.style.position = 'absolute'
    loader.style.top = '50%'
    loader.style.left = '50%'
    loader.style.transform = 'translate(-50%, -50%)'
    loader.style.zIndex = '2147483647'
    loader.style.colorScheme = 'auto'

    const spinner = document.createElement('div')
    spinner.className = 'polar-loader-spinner'
    loader.appendChild(spinner)

    document.body.classList.add('polar-no-scroll')
    document.body.appendChild(loader)

    const embedURL = new URL(EMBED_PATH, resolveEmbedBaseURL())
    embedURL.searchParams.set('session_token', sessionToken)
    embedURL.searchParams.set('embed', 'true')
    embedURL.searchParams.set('embed_origin', window.location.origin)
    embedURL.searchParams.set('mode', 'modal')
    embedURL.searchParams.set(
      'embed_return_url',
      returnUrl ?? window.location.href,
    )
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
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.zIndex = '2147483647'
    iframe.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    iframe.style.colorScheme = 'normal'

    iframe.allow = buildIframeAllow()

    document.body.appendChild(iframe)

    const embed = new EmbedPaymentMethod(iframe, 'modal', loader)

    if (onLoaded) {
      embed.addEventListener('loaded', onLoaded, { once: true })
    }

    return new Promise((resolve) => {
      embed.addEventListener('loaded', () => resolve(embed), { once: true })
    })
  }

  /**
   * Mount a chrome-less embed inline, inside an element you control.
   */
  public static createInline(
    options: EmbedPaymentMethodCreateInlineOptions,
  ): EmbedPaymentMethod {
    const { sessionToken, element, theme, setAsDefault, locale, onLoaded } =
      options

    const embedURL = new URL(EMBED_PATH, resolveEmbedBaseURL())
    embedURL.searchParams.set('session_token', sessionToken)
    embedURL.searchParams.set('embed', 'true')
    embedURL.searchParams.set('embed_origin', window.location.origin)
    embedURL.searchParams.set('mode', 'inline')
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
    iframe.style.colorScheme = 'normal'
    iframe.allow = buildIframeAllow()

    element.replaceChildren(iframe)

    const embed = new EmbedPaymentMethod(iframe, 'inline', null)

    if (onLoaded) {
      embed.addEventListener('loaded', onLoaded, { once: true })
    }

    return embed
  }

  /**
   * Initialize click triggers on elements marked with the
   * `data-polar-payment-method` attribute. The attribute value is the
   * customer session token. Theme can be set via
   * `data-polar-payment-method-theme="dark"`.
   *
   * @example
   * ```html
   * <button
   *   data-polar-payment-method="polar_cst_xxx"
   *   data-polar-payment-method-theme="dark"
   * >
   *   Add payment method
   * </button>
   * ```
   */
  public static init(): void {
    const elements = document.querySelectorAll('[data-polar-payment-method]')
    elements.forEach((element) => {
      element.removeEventListener(
        'click',
        EmbedPaymentMethod.elementClickHandler,
      )
      element.addEventListener('click', EmbedPaymentMethod.elementClickHandler)
    })
  }

  public static getRedirectResult(): EmbedPaymentMethodRedirectResult | null {
    if (typeof window === 'undefined') {
      return null
    }
    const params = new URLSearchParams(window.location.search)
    const status = params.get(REDIRECT_STATUS_PARAM)
    if (status !== 'succeeded' && status !== 'failed') {
      return null
    }
    params.delete(REDIRECT_STATUS_PARAM)
    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
    return { status }
  }

  /**
   * Close the embed and remove it from the DOM.
   */
  public close(): void {
    window.removeEventListener('message', this.windowMessageListener)
    this.iframe.remove()
    if (this.mode === 'modal') {
      document.body.classList.remove('polar-no-scroll')
    }
  }

  public addEventListener(
    type: 'loaded',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageLoaded>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'close',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageClose>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'confirmed',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageConfirmed>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'success',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageSuccess>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'error',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageError>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: any,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.eventTarget.addEventListener(type, listener, options)
  }

  public removeEventListener(
    type: 'loaded',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageLoaded>) => void,
  ): void
  public removeEventListener(
    type: 'close',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageClose>) => void,
  ): void
  public removeEventListener(
    type: 'confirmed',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageConfirmed>) => void,
  ): void
  public removeEventListener(
    type: 'success',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageSuccess>) => void,
  ): void
  public removeEventListener(
    type: 'error',
    listener: (event: CustomEvent<EmbedPaymentMethodMessageError>) => void,
  ): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public removeEventListener(type: string, listener: any): void {
    this.eventTarget.removeEventListener(type, listener)
  }

  private static async elementClickHandler(e: Event) {
    e.preventDefault()
    let element = e.target as HTMLElement

    while (!element.hasAttribute('data-polar-payment-method')) {
      if (!element.parentElement) {
        return
      }
      element = element.parentElement
    }

    const token = element.getAttribute('data-polar-payment-method')
    if (!token) {
      return
    }
    const theme = element.getAttribute('data-polar-payment-method-theme') as
      | 'light'
      | 'dark'
      | null
    const setAsDefaultAttr = element.getAttribute(
      'data-polar-payment-method-set-as-default',
    )
    const returnUrl = element.getAttribute(
      'data-polar-payment-method-return-url',
    )
    const locale = element.getAttribute('data-polar-payment-method-locale')
    EmbedPaymentMethod.create({
      sessionToken: token,
      theme: theme ?? undefined,
      setAsDefault:
        setAsDefaultAttr === null ? undefined : setAsDefaultAttr !== 'false',
      returnUrl: returnUrl ?? undefined,
      locale: locale ?? undefined,
    })
  }

  private handleLoaded(): void {
    if (this.loaded) {
      return
    }
    // Inline embeds have no loader overlay; only the modal does.
    if (this.loader && document.body.contains(this.loader)) {
      document.body.removeChild(this.loader)
    }
    this.loaded = true
  }

  private handleClose(): void {
    if (this.closable) {
      this.close()
    }
  }

  private handleConfirmed(): void {
    this.closable = false
  }

  private handleSuccess(): void {
    // Inline embeds stay mounted — the host page decides what's next.
    if (this.mode === 'inline') {
      return
    }
    this.closable = true
    this.close()
  }

  private handleError(): void {
    this.closable = true
  }

  /**
   * Validate origin, parse the message, dispatch a cancelable
   * `CustomEvent` to consumer listeners, then run the default action
   * unless a listener called `event.preventDefault()`.
   */
  private handleWindowMessage({ data, origin }: MessageEvent): void {
    if (
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Defined at build time by tsup
      !__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__
        .split(',')
        .includes(origin)
    ) {
      return
    }
    if (!isEmbedPaymentMethodMessage(data)) {
      return
    }

    // `resize` is an internal protocol message: inline embeds use it to
    // keep the iframe sized to its content; modal embeds ignore it. It's
    // never surfaced as a public event.
    if (data.event === 'resize') {
      if (this.mode === 'inline') {
        this.iframe.style.height = `${Math.max(0, Math.ceil(data.height))}px`
      }
      return
    }

    const event = new CustomEvent(data.event, {
      detail: data,
      cancelable: true,
    })
    this.eventTarget.dispatchEvent(event)
    if (event.defaultPrevented) {
      return
    }
    switch (data.event) {
      case 'loaded':
        this.handleLoaded()
        break
      case 'close':
        this.handleClose()
        break
      case 'confirmed':
        this.handleConfirmed()
        break
      case 'success':
        this.handleSuccess()
        break
      case 'error':
        this.handleError()
        break
    }
  }
}

declare global {
  interface PolarWindow {
    EmbedPaymentMethod: typeof EmbedPaymentMethod
  }
  interface Window {
    Polar: Partial<PolarWindow>
  }
}

if (typeof window !== 'undefined') {
  window.Polar = {
    ...(window.Polar ?? {}),
    EmbedPaymentMethod,
  }
}

if (typeof document !== 'undefined') {
  const currentScript = document.currentScript as HTMLScriptElement | null
  if (currentScript && currentScript.hasAttribute('data-auto-init')) {
    document.addEventListener('DOMContentLoaded', () => {
      EmbedPaymentMethod.init()
    })
  }
}

export {
  EmbedPaymentMethod as PolarEmbedPaymentMethod,
  REDIRECT_STATUS_PARAM as EMBED_PAYMENT_METHOD_REDIRECT_STATUS_PARAM,
}
