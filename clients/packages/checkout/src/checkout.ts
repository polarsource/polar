import { createSpinner, spinnerStyles } from './utils/spinner'

const POLAR_CHECKOUT_EVENT = 'POLAR_CHECKOUT'
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.5)'

/**
 * Message sent to the parent window when the embedded checkout is fully loaded.
 */
interface EmbedCheckoutMessageLoaded {
  event: 'loaded'
}

/**
 * Message sent to the parent window when the embedded checkout needs to be closed.
 */
interface EmbedCheckoutMessageClose {
  event: 'close'
}

/**
 * Message sent to the parent window when the checkout is confirmed.
 *
 * At that point, the parent window shouldn't allow to close the checkout.
 */
interface EmbedCheckoutMessageConfirmed {
  event: 'confirmed'
}

/**
 * Message sent to the parent window when the checkout is successfully completed.
 *
 * If `redirect` is set to `true`, the parent window should redirect to the `successURL`.
 */
interface EmbedCheckoutMessageSuccess {
  event: 'success'
  successURL: string
  redirect: boolean
}

/**
 * Represents an embedded checkout message.
 */
type EmbedCheckoutMessage =
  | EmbedCheckoutMessageLoaded
  | EmbedCheckoutMessageClose
  | EmbedCheckoutMessageConfirmed
  | EmbedCheckoutMessageSuccess

const isEmbedCheckoutMessage = (
  // oxlint-disable-next-line typescript/no-explicit-any
  message: any,
): message is EmbedCheckoutMessage => {
  return message.type === POLAR_CHECKOUT_EVENT
}

/**
 * Represents an embedded checkout instance.
 */
class EmbedCheckout {
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
   * Send an embed checkout event to the parent window.
   * @param message
   * @param targetOrigin
   */
  public static postMessage(
    message: EmbedCheckoutMessage,
    targetOrigin: string,
  ): void {
    window.parent.postMessage(
      { ...message, type: POLAR_CHECKOUT_EVENT },
      targetOrigin,
    )
  }

  /**
   * Create a new embedded checkout instance by injecting an iframe into the DOM.
   *
   * @param url A Checkout Link.
   * @param options Configuration options for the embedded checkout.
   * @param options.theme The theme of the embedded checkout. Defaults to `light`.
   * @param options.onLoaded Callback function that will be invoked when the checkout is fully loaded.
   *
   * @returns A promise that resolves to an instance of EmbedCheckout.
   * The promise resolves when the embedded checkout is fully loaded.
   */
  public static async create(
    url: string,
    options?: {
      theme?: 'light' | 'dark'
      onLoaded?: (event: CustomEvent<EmbedCheckoutMessageLoaded>) => void
    },
  ): Promise<EmbedCheckout> {
    if (typeof options === 'string') {
      console.warn(
        `Passing theme as string is deprecated. Use { theme: "${options}" } instead.`,
      )
      options = { theme: options }
    }

    // Add query parameters to the Checkout Link
    const parsedURL = new URL(url)
    parsedURL.searchParams.set('embed', 'true')
    parsedURL.searchParams.set('embed_origin', window.location.origin)
    if (options?.theme) {
      parsedURL.searchParams.set('theme', options.theme)
    }
    const embedURL = parsedURL.toString()

    // The embedded page reads its theme from the URL, which may carry one
    // the options didn't set; the iframe must use the same color-scheme.
    const theme =
      parsedURL.searchParams.get('theme') === 'dark' ? 'dark' : 'light'

    const spinnerColor = theme === 'dark' ? '#fff' : '#000'
    const styleSheet = document.createElement('style')
    styleSheet.innerText = `
      .polar-loader {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: ${BACKDROP_COLOR};
      }
      .polar-loader-card {
        position: absolute;
        inset: 0;
        max-width: 512px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 24px;
        background: ${theme === 'dark' ? '#111' : '#f9fafb'};
        color: ${spinnerColor};
      }
      @media (min-width: 768px) {
        .polar-loader-card {
          inset: 24px;
          background: ${theme === 'dark' ? '#111' : '#fff'};
        }
      }
      @media (min-width: 1024px) {
        .polar-loader-card {
          border-radius: 32px;
        }
      }
      ${spinnerStyles}
      body.polar-no-scroll {
        overflow: hidden;
      }
    `
    document.head.appendChild(styleSheet)

    // Create loader
    const loader = document.createElement('div')
    loader.className = 'polar-loader'
    loader.style.colorScheme = 'auto'

    const card = document.createElement('div')
    card.className = 'polar-loader-card'
    loader.appendChild(card)

    // Create spinning icon
    const spinner = createSpinner()
    card.appendChild(spinner)

    // Insert into the DOM
    document.body.classList.add('polar-no-scroll')
    document.body.appendChild(loader)

    // Create iframe
    const iframe = document.createElement('iframe')
    iframe.src = embedURL
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.zIndex = '2147483647'
    iframe.style.colorScheme = theme

    // Opt the overlay out of smooth-scroll libraries (Lenis) on the embedding
    // page, which would otherwise scroll it behind the checkout.
    iframe.setAttribute('data-lenis-prevent', '')

    // oxlint-disable-next-line typescript/ban-ts-comment
    // @ts-ignore
    const origins = __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__
      .split(',')
      .join(' ')
    iframe.allow = `payment 'self' ${origins}; publickey-credentials-get 'self' ${origins};`

    document.body.appendChild(iframe)

    const embedCheckout = new EmbedCheckout(iframe, loader)

    if (options?.onLoaded) {
      embedCheckout.addEventListener('loaded', options.onLoaded, { once: true })
    }

    return new Promise((resolve) => {
      embedCheckout.addEventListener('loaded', () => resolve(embedCheckout), {
        once: true,
      })
    })
  }

  /**
   * Initialize embedded checkout triggers.
   *
   * This method will add a click event listener to all elements with the `data-polar-checkout` attribute.
   * The Checkout Link is either the `href` attribute for a link element or the value of `data-polar-checkout` attribute.
   *
   * The theme can be optionally set using the `data-polar-checkout-theme` attribute.
   *
   * @example
   * ```html
   * <a href="https://buy.polar.sh/polar_cl_123" data-polar-checkout data-polar-checkout-theme="dark">Checkout</a>
   * ```
   */
  public static init(): void {
    const checkoutElements = document.querySelectorAll('[data-polar-checkout]')
    checkoutElements.forEach((checkoutElement) => {
      checkoutElement.removeEventListener(
        'click',
        EmbedCheckout.checkoutElementClickHandler,
      )
      checkoutElement.addEventListener(
        'click',
        EmbedCheckout.checkoutElementClickHandler,
      )
    })
  }

  /**
   * Close the embedded checkout.
   */
  public close(): void {
    window.removeEventListener('message', this.windowMessageListener)
    if (document.body.contains(this.iframe))
      document.body.removeChild(this.iframe)
    this.loader.remove()
    document.body.classList.remove('polar-no-scroll')
  }

  /**
   * Add an event listener to the embedded checkout events.
   *
   * @param type
   * @param listener
   */
  public addEventListener(
    type: 'loaded',
    listener: (event: CustomEvent<EmbedCheckoutMessageLoaded>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'close',
    listener: (event: CustomEvent<EmbedCheckoutMessageClose>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'confirmed',
    listener: (event: CustomEvent<EmbedCheckoutMessageConfirmed>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: 'success',
    listener: (event: CustomEvent<EmbedCheckoutMessageSuccess>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  public addEventListener(
    type: string,
    // oxlint-disable-next-line typescript/no-explicit-any
    listener: any,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.eventTarget.addEventListener(type, listener, options)
  }

  /**
   * Remove an event listener from the embedded checkout events.
   *
   * @param type
   * @param listener
   */
  public removeEventListener(
    type: 'loaded',
    listener: (event: CustomEvent<EmbedCheckoutMessageLoaded>) => void,
  ): void
  public removeEventListener(
    type: 'close',
    listener: (event: CustomEvent<EmbedCheckoutMessageClose>) => void,
  ): void
  public removeEventListener(
    type: 'confirmed',
    listener: (event: CustomEvent<EmbedCheckoutMessageConfirmed>) => void,
  ): void
  public removeEventListener(
    type: 'success',
    listener: (event: CustomEvent<EmbedCheckoutMessageSuccess>) => void,
  ): void
  // oxlint-disable-next-line typescript/no-explicit-any
  public removeEventListener(type: string, listener: any): void {
    this.eventTarget.removeEventListener(type, listener)
  }

  private static async checkoutElementClickHandler(e: Event) {
    e.preventDefault()
    let checkoutElement = e.target as HTMLElement

    // Find the closest parent element with the `data-polar-checkout` attribute,
    // in case the checkout element has children triggering the event.
    while (!checkoutElement.hasAttribute('data-polar-checkout')) {
      if (!checkoutElement.parentElement) {
        return
      }
      checkoutElement = checkoutElement.parentElement
    }

    const url =
      checkoutElement.getAttribute('href') ||
      (checkoutElement.getAttribute('data-polar-checkout') as string)
    const theme = checkoutElement.getAttribute('data-polar-checkout-theme') as
      | 'light'
      | 'dark'
      | undefined
    EmbedCheckout.create(url, theme ? { theme } : undefined)
  }

  /**
   * Default action for the `loaded` event: remove the loader and hand its
   * backdrop over to the iframe.
   */
  private handleLoaded(): void {
    if (this.loaded) {
      return
    }
    this.iframe.style.backgroundColor = BACKDROP_COLOR
    this.loader.remove()
    this.loaded = true
  }

  /**
   * Default action for the `close` event: remove the embedded checkout from
   * the DOM, unless closing has been locked by a prior `confirmed` event.
   */
  private handleClose(): void {
    if (this.closable) {
      this.close()
    }
  }

  /**
   * Default action for the `confirmed` event: lock closing while the
   * checkout is being processed.
   */
  private handleConfirmed(): void {
    this.closable = false
  }

  /**
   * Default action for the `success` event: re-enable closing and, if
   * requested, redirect the parent window to the `successURL`.
   */
  private handleSuccess(detail: EmbedCheckoutMessageSuccess): void {
    this.closable = true
    if (detail.redirect) {
      window.location.href = detail.successURL
    }
  }

  /**
   * Handle window message events from the embedded checkout iframe.
   *
   * Dispatches a cancelable `CustomEvent` to consumer listeners first, then
   * runs the default action unless a listener called `event.preventDefault()`.
   */
  private handleWindowMessage({ data, origin }: MessageEvent): void {
    if (
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore
      !__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__
        .split(',')
        .includes(origin)
    ) {
      return
    }
    if (!isEmbedCheckoutMessage(data)) {
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
        this.handleSuccess(data)
        break
    }
  }
}

declare global {
  interface PolarWindow {
    EmbedCheckout: typeof EmbedCheckout
  }
  interface Window {
    Polar: Partial<PolarWindow>
  }
}

if (typeof window !== 'undefined') {
  window.Polar = {
    ...(window.Polar ?? {}),
    EmbedCheckout,
  }
}

if (typeof document !== 'undefined') {
  const currentScript = document.currentScript as HTMLScriptElement | null
  if (currentScript && currentScript.hasAttribute('data-auto-init')) {
    document.addEventListener('DOMContentLoaded', async () => {
      EmbedCheckout.init()
    })
  }
}

export { EmbedCheckout as PolarEmbedCheckout }
