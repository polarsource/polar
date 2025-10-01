const POLAR_CHECKOUT_EVENT = 'POLAR_CHECKOUT'

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

  public constructor(iframe: HTMLIFrameElement, loader: HTMLDivElement) {
    this.iframe = iframe
    this.loader = loader
    this.loaded = false
    this.closable = true
    this.eventTarget = new EventTarget()
    this.initWindowListener()
    this.addEventListener('loaded', this.loadedListener.bind(this))
    this.addEventListener('close', this.closeListener.bind(this))
    this.addEventListener('confirmed', this.confirmedListener.bind(this))
    this.addEventListener('success', this.successListener.bind(this))
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
   * @param theme The theme of the embedded checkout. Defaults to `light`.

   * @returns A promise that resolves to an instance of EmbedCheckout.
   * The promise resolves when the embedded checkout is fully loaded.
   */
  public static async create(
    url: string,
    theme?: 'light' | 'dark',
  ): Promise<EmbedCheckout> {
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

    // Create loader
    const loader = document.createElement('div')
    loader.style.position = 'absolute'
    loader.style.top = '50%'
    loader.style.left = '50%'
    loader.style.transform = 'translate(-50%, -50%)'
    loader.style.zIndex = '2147483647'
    loader.style.colorScheme = 'auto'

    // Create spinning icon
    const spinner = document.createElement('div')
    spinner.className = 'polar-loader-spinner'
    loader.appendChild(spinner)

    // Insert into the DOM
    document.body.classList.add('polar-no-scroll')
    document.body.appendChild(loader)

    // Add query parameters to the Checkout Link
    const parsedURL = new URL(url)
    parsedURL.searchParams.set('embed', 'true')
    parsedURL.searchParams.set('embed_origin', window.location.origin)
    if (theme) {
      parsedURL.searchParams.set('theme', theme)
    }
    const embedURL = parsedURL.toString()

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
    iframe.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    iframe.style.colorScheme = 'auto'

    // @ts-ignore
    const origins = __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__
      .split(',')
      .join(' ')
    iframe.allow = `payment 'self' ${origins}; publickey-credentials-get 'self' ${origins};`

    document.body.appendChild(iframe)

    const embedCheckout = new EmbedCheckout(iframe, loader)
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
    if (document.body.contains(this.iframe))
      document.body.removeChild(this.iframe)
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
    EmbedCheckout.create(url, theme)
  }

  /**
   * Default listener for the `loaded` event.
   *
   * This listener will remove the loader spinner when the embedded checkout is fully loaded.
   */
  private loadedListener(event: CustomEvent<EmbedCheckoutMessageLoaded>): void {
    if (event.defaultPrevented || this.loaded) {
      return
    }
    document.body.removeChild(this.loader)
    this.loaded = true
  }

  /**
   * Default listener for the `close` event.
   *
   * This listener will call the `close` method to remove the embedded checkout from the DOM.
   */
  private closeListener(event: CustomEvent<EmbedCheckoutMessageClose>): void {
    if (event.defaultPrevented) {
      return
    }
    if (this.closable) {
      this.close()
    }
  }

  /**
   * Default listener for the `confirmed` event.
   *
   * This listener will set a flag to prevent the parent window from closing the embedded checkout.
   */
  private confirmedListener(
    event: CustomEvent<EmbedCheckoutMessageConfirmed>,
  ): void {
    if (event.defaultPrevented) {
      return
    }
    this.closable = false
  }

  /**
   * Default listener for the `success` event.
   *
   * This listener will redirect the parent window to the `successURL` if `redirect` is set to `true`.
   */
  private successListener(
    event: CustomEvent<EmbedCheckoutMessageSuccess>,
  ): void {
    if (event.defaultPrevented) {
      return
    }
    this.closable = true
    if (event.detail.redirect) {
      window.location.href = event.detail.successURL
    }
  }

  /**
   * Initialize the window message listener to receive messages from the embedded checkout
   * and re-dispatch them as events for the embedded checkout instance.
   */
  private initWindowListener(): void {
    window.addEventListener('message', ({ data, origin }) => {
      if (
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
      this.eventTarget.dispatchEvent(
        new CustomEvent(data.event, { detail: data, cancelable: true }),
      )
    })
  }
}

declare global {
  interface Window {
    Polar: {
      EmbedCheckout: typeof EmbedCheckout
    }
  }
}

if (typeof window !== 'undefined') {
  window.Polar = {
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
