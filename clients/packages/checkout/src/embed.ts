interface EmbedCheckoutMessageLoaded {
  event: 'loaded'
}

interface EmbedCheckoutMessageClose {
  event: 'close'
}

interface EmbedCheckoutMessageSuccess {
  event: 'success'
  successURL: string
  redirect: boolean
}

type EmbedCheckoutMessage =
  | EmbedCheckoutMessageLoaded
  | EmbedCheckoutMessageClose
  | EmbedCheckoutMessageSuccess

const POLAR_CHECKOUT_EVENT = 'POLAR_CHECKOUT'

class EmbedCheckout {
  private iframe: HTMLIFrameElement

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
  }

  static postMessage(message: EmbedCheckoutMessage): void {
    window.parent.postMessage({ ...message, type: POLAR_CHECKOUT_EVENT }, '*')
  }

  static async create(
    url: string,
    theme?: 'light' | 'dark',
  ): Promise<EmbedCheckout> {
    // Add embed=true query parameter
    const parsedURL = new URL(url)
    parsedURL.searchParams.set('embed', 'true')
    if (theme) {
      parsedURL.searchParams.set('theme', theme)
    }
    const embedURL = parsedURL.toString()

    // Create loader container
    const loaderContainer = document.createElement('div')
    loaderContainer.style.position = 'fixed'
    loaderContainer.style.top = '0'
    loaderContainer.style.left = '0'
    loaderContainer.style.width = '100%'
    loaderContainer.style.height = '100%'
    loaderContainer.style.zIndex = '999'

    // Create loader backdrop
    const backdrop = document.createElement('div')
    backdrop.style.position = 'absolute'
    backdrop.style.top = '0'
    backdrop.style.left = '0'
    backdrop.style.width = '100%'
    backdrop.style.height = '100%'
    backdrop.style.backgroundColor = 'hsl(233 10% 3% / 0.5)'
    loaderContainer.appendChild(backdrop)

    // Create loader
    const loader = document.createElement('div')
    loader.style.position = 'absolute'
    loader.style.top = '50%'
    loader.style.left = '50%'
    loader.style.transform = 'translate(-50%, -50%)'
    loader.style.zIndex = '1000'

    // Create spinning icon
    const spinner = document.createElement('div')
    spinner.style.border = '8px solid hsl(233, 10%, 7%)'
    spinner.style.borderTop = '8px solid hsl(233, 10%, 85%)'
    spinner.style.borderRadius = '50%'
    spinner.style.width = '32px'
    spinner.style.height = '32px'
    spinner.style.animation = 'polar-spin 2s linear infinite'

    // Add keyframes for spin animation
    const styleSheet = document.createElement('style')
    styleSheet.innerText = `
      @keyframes polar-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      body.polar-no-scroll {
        overflow: hidden;
      }
    `
    document.head.appendChild(styleSheet)

    document.body.classList.add('polar-no-scroll')
    loader.appendChild(spinner)
    loaderContainer.appendChild(loader)
    document.body.appendChild(loaderContainer)

    // Create iframe
    const iframe = document.createElement('iframe')
    iframe.src = embedURL
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.zIndex = '1000'

    // Append iframe to the body
    document.body.appendChild(iframe)

    const embedCheckout = new EmbedCheckout(iframe)

    return new Promise((resolve) => {
      window.addEventListener('message', (event) => {
        if (event.data.type !== POLAR_CHECKOUT_EVENT) {
          return
        }
        const data = event.data as EmbedCheckoutMessage
        if (data.event === 'loaded') {
          document.body.removeChild(loaderContainer)
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

  public close(): void {
    document.body.removeChild(this.iframe)
    document.body.classList.remove('polar-no-scroll')
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
  if (currentScript && currentScript.hasAttribute('data-auto')) {
    document.addEventListener('DOMContentLoaded', async () => {
      const checkoutElements = document.querySelectorAll(
        '[data-polar-checkout]',
      )
      checkoutElements.forEach((checkoutElement) => {
        checkoutElement.addEventListener('click', (e) => {
          e.preventDefault()
          const url =
            checkoutElement.getAttribute('href') ||
            (checkoutElement.getAttribute('data-polar-checkout') as string)
          const theme = checkoutElement.getAttribute(
            'data-polar-checkout-theme',
          ) as 'light' | 'dark' | undefined
          EmbedCheckout.create(url, theme)
        })
      })
    })
  }
}

export { EmbedCheckout as PolarEmbedCheckout }
