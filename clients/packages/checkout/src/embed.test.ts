import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PolarEmbedCheckout } from './embed'

const ALLOWED_ORIGIN = 'http://127.0.0.1:3000'

beforeAll(() => {
  // Define the build-time global that embed.ts expects
  // @ts-expect-error - Global defined at build time by tsup
  globalThis.__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ = ALLOWED_ORIGIN
})

describe('PolarEmbedCheckout', () => {
  describe('postMessage', () => {
    it('posts a message to the parent window with the correct type', () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

      PolarEmbedCheckout.postMessage({ event: 'loaded' }, ALLOWED_ORIGIN)

      expect(postMessageSpy).toHaveBeenCalledWith(
        { event: 'loaded', type: 'POLAR_CHECKOUT' },
        ALLOWED_ORIGIN,
      )

      postMessageSpy.mockRestore()
    })

    it('includes event data for success messages', () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

      PolarEmbedCheckout.postMessage(
        {
          event: 'success',
          successURL: 'https://example.com/success',
          redirect: true,
        },
        ALLOWED_ORIGIN,
      )

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          event: 'success',
          successURL: 'https://example.com/success',
          redirect: true,
          type: 'POLAR_CHECKOUT',
        },
        ALLOWED_ORIGIN,
      )

      postMessageSpy.mockRestore()
    })
  })

  describe('create', () => {
    afterEach(() => {
      // Clean up any iframes and loaders left in the DOM
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    it('creates an iframe with the correct src', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      // Simulate the loaded event from the iframe
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      const iframe = document.querySelector('iframe')
      expect(iframe).not.toBeNull()

      const src = new URL(iframe!.src)
      expect(src.pathname).toBe('/polar_cl_123')
      expect(src.searchParams.get('embed')).toBe('true')
      expect(src.searchParams.get('embed_origin')).toBe(window.location.origin)

      checkout.close()
    })

    it('sets theme query parameter when provided', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
        { theme: 'dark' },
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      const iframe = document.querySelector('iframe')
      const src = new URL(iframe!.src)
      expect(src.searchParams.get('theme')).toBe('dark')

      checkout.close()
    })

    it('adds polar-no-scroll class to body', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.close()
    })

    it('calls onLoaded callback when checkout loads', async () => {
      const onLoaded = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
        { onLoaded },
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      expect(onLoaded).toHaveBeenCalledTimes(1)

      checkout.close()
    })
  })

  describe('close', () => {
    afterEach(() => {
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    it('removes the iframe from the DOM', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()

      expect(document.querySelector('iframe')).toBeNull()
    })

    it('removes polar-no-scroll class from body', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.close()

      expect(document.body.classList.contains('polar-no-scroll')).toBe(false)
    })
  })

  describe('event handling', () => {
    afterEach(() => {
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    it('dispatches close event and removes iframe', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).toBeNull()

      // Clean up listeners
      checkout.close()
    })

    it('prevents close after confirmed event', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      // Confirm — should prevent closing
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      // Try to close via event — should be blocked
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()

      // Force cleanup
      checkout.close()
    })

    it('ignores messages from disallowed origins', async () => {
      const closeListener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('close', closeListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.com',
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(closeListener).not.toHaveBeenCalled()
      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('ignores messages that are not embed checkout messages', async () => {
      const closeListener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('close', closeListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'SOME_OTHER_EVENT', event: 'close' },
        }),
      )

      expect(closeListener).not.toHaveBeenCalled()

      checkout.close()
    })

    it('skips the default loaded action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
        { onLoaded: (event) => event.preventDefault() },
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      // Loader spinner should still be in the DOM since the default action
      // (removing the loader) was prevented.
      expect(document.querySelector('.polar-loader-spinner')).not.toBeNull()

      checkout.close()
    })

    it('skips the default close action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('close', (event) => event.preventDefault())

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('skips the default confirmed action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('confirmed', (event) => event.preventDefault())

      // Confirm — but listener prevents default, so closable should stay true.
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      // Close should still work since closable was not flipped to false.
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).toBeNull()
    })

    it('skips the default success action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      // Lock closing first, then dispatch success with a listener that
      // prevents default — closing must remain locked because the default
      // action (re-enabling closing) was skipped.
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      checkout.addEventListener('success', (event) => event.preventDefault())

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_CHECKOUT',
            event: 'success',
            successURL: 'https://example.com/thanks',
            redirect: false,
          },
        }),
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('re-enables closing after success event', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise

      // Confirm to lock closing
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      // Success with redirect=false should re-enable closing
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_CHECKOUT',
            event: 'success',
            successURL: 'https://example.com/thanks',
            redirect: false,
          },
        }),
      )

      // Now close should work again
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).toBeNull()

      checkout.close()
    })
  })

  describe('addEventListener / removeEventListener', () => {
    afterEach(() => {
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    it('fires custom event listeners', async () => {
      const listener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('confirmed', listener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      expect(listener).toHaveBeenCalledTimes(1)

      checkout.close()
    })

    it('removes event listeners', async () => {
      const listener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'loaded' },
        }),
      )

      const checkout = await promise
      checkout.addEventListener('confirmed', listener)
      checkout.removeEventListener('confirmed', listener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'confirmed' },
        }),
      )

      expect(listener).not.toHaveBeenCalled()

      checkout.close()
    })
  })

  describe('init', () => {
    afterEach(() => {
      document
        .querySelectorAll('[data-polar-checkout]')
        .forEach((el) => el.remove())
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    it('attaches click handlers to elements with data-polar-checkout', () => {
      const link = document.createElement('a')
      link.href = 'https://buy.polar.sh/polar_cl_123'
      link.setAttribute('data-polar-checkout', '')
      document.body.appendChild(link)

      PolarEmbedCheckout.init()

      // Click should create an iframe
      link.click()

      const iframe = document.querySelector('iframe')
      expect(iframe).not.toBeNull()
    })
  })

  describe('window.Polar', () => {
    it('exposes EmbedCheckout on window.Polar', () => {
      expect(window.Polar).toBeDefined()
      expect(window.Polar.EmbedCheckout).toBe(PolarEmbedCheckout)
    })
  })
})
