class EmbedCheckout {
  private iframe: HTMLIFrameElement

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
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
  `
    document.head.appendChild(styleSheet)

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

    return new Promise(function (resolve) {
      window.addEventListener('message', function (event) {
        if (event.data === 'polarCheckoutLoaded') {
          document.body.removeChild(loaderContainer)
          resolve(embedCheckout)
        } else if (event.data === 'polarCheckoutClose') {
          embedCheckout.close()
        }
      })
    })
  }

  public close() {
    document.body.removeChild(this.iframe)
  }
}

declare global {
  interface Window {
    Polar: {
      EmbedCheckout: typeof EmbedCheckout
    }
  }
}

window.Polar = {
  EmbedCheckout,
}

document.addEventListener('DOMContentLoaded', async () => {
  const checkoutElements = document.querySelectorAll('[data-polar-checkout]')
  checkoutElements.forEach((checkoutElement) => {
    checkoutElement.addEventListener('click', function () {
      const url = checkoutElement.getAttribute('data-polar-checkout') as string
      const theme = checkoutElement.getAttribute(
        'data-polar-checkout-theme',
      ) as 'light' | 'dark' | undefined
      EmbedCheckout.create(url, theme)
    })
  })
})

export { EmbedCheckout as PolarEmbedCheckout }
