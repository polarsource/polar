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
  | EmbedCheckoutMessageSuccess

/**
 * Represents an embedded checkout instance.
 */
class EmbedCheckout {
  private iframe: HTMLIFrameElement

  public constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
  }

  /**
   * Send a embed checkout event to the parent window.
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
    iframe.style.backgroundColor = 'rgba(0, 0, 0, 0.2)'
    document.body.appendChild(iframe)

    const embedCheckout = new EmbedCheckout(iframe)

    return new Promise((resolve) => {
      window.addEventListener('message', (event) => {
        // @ts-ignore
        if (!__POLAR_ALLOWED_ORIGINS__.split(',').includes(event.origin)) {
          return
        }
        if (event.data.type !== POLAR_CHECKOUT_EVENT) {
          return
        }
        const data = event.data as EmbedCheckoutMessage
        if (data.event === 'loaded') {
          document.body.removeChild(loader)
          resolve(embedCheckout)
        } else if (data.event === 'close') {
          embedCheckout.close()
        } else if (data.event === 'success') {
          if (data.redirect) {
            window.location.href = data.successURL
          }
        }
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
    document.body.removeChild(this.iframe)
    document.body.classList.remove('polar-no-scroll')
  }

  private static async checkoutElementClickHandler(e: Event) {
    e.preventDefault()
    const checkoutElement = e.target as HTMLElement
    const url =
      checkoutElement.getAttribute('href') ||
      (checkoutElement.getAttribute('data-polar-checkout') as string)
    const theme = checkoutElement.getAttribute('data-polar-checkout-theme') as
      | 'light'
      | 'dark'
      | undefined
    EmbedCheckout.create(url, theme)
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
