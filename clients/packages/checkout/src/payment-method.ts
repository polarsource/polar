const POLAR_PAYMENT_METHOD_EVENT = 'POLAR_PAYMENT_METHOD'
const EMBED_PATH = '/embed/payment-method'

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
 * Message sent to the parent window when the iframe can't render the
 * form (e.g. token missing, expired, or rejected by the server).
 */
interface EmbedPaymentMethodMessageError {
  event: 'error'
  code: 'invalid_request' | 'unauthorized' | 'unknown'
}

/**
 * Internal: iframe announces its current content height. Consumed by
 * inline-mode embeds (the React component) to keep the iframe sized to
 * its content. Not exposed to consumers.
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
   * Convenience callback fired once when the embed has loaded.
   */
  onLoaded?: (event: CustomEvent<EmbedPaymentMethodMessageLoaded>) => void
}

const resolveEmbedBaseURL = (): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Defined at build time by tsup
  const origins = __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ as string
  return origins.split(',')[0]
}

/**
 * Represents an embedded payment method instance rendered as a
 * full-screen modal overlay on the merchant's page.
 *
 * For an inline, chrome-less embed that can be composed into a custom
 * UI, use the React component at `@polar-sh/checkout/react/payment-method`.
 */
class EmbedPaymentMethod {
  private iframe: HTMLIFrameElement
  private loader: HTMLDivElement
  private loaded: boolean
  private closable: boolean
  private eventTarget: EventTarget
  private windowMessageListener: (event: MessageEvent) => void

  public constructor(iframe: HTMLIFrameElement, loader: HTMLDivElement) {
    this.iframe = iframe
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
    const { sessionToken, theme, setAsDefault, onLoaded } = options

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
    if (theme) {
      embedURL.searchParams.set('theme', theme)
    }
    if (setAsDefault === false) {
      embedURL.searchParams.set('set_default', 'false')
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
    iframe.style.colorScheme = 'auto'

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Defined at build time by tsup
    const origins = __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__
      .split(',')
      .join(' ')
    iframe.allow = `payment 'self' ${origins}; publickey-credentials-get 'self' ${origins};`

    document.body.appendChild(iframe)

    const embed = new EmbedPaymentMethod(iframe, loader)

    if (onLoaded) {
      embed.addEventListener('loaded', onLoaded, { once: true })
    }

    return new Promise((resolve) => {
      embed.addEventListener('loaded', () => resolve(embed), { once: true })
    })
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

  /**
   * Close the embed and remove it from the DOM.
   */
  public close(): void {
    window.removeEventListener('message', this.windowMessageListener)
    if (document.body.contains(this.iframe))
      document.body.removeChild(this.iframe)
    document.body.classList.remove('polar-no-scroll')
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
    EmbedPaymentMethod.create({
      sessionToken: token,
      theme: theme ?? undefined,
      setAsDefault:
        setAsDefaultAttr === null ? undefined : setAsDefaultAttr !== 'false',
    })
  }

  private handleLoaded(): void {
    if (this.loaded) {
      return
    }
    document.body.removeChild(this.loader)
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
    this.closable = true
    this.close()
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

    // `resize` is an internal protocol message used by inline embeds —
    // never relevant for modal mode, so silently drop it.
    if (data.event === 'resize') {
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

export { EmbedPaymentMethod as PolarEmbedPaymentMethod }
