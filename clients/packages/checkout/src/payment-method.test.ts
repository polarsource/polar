import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PolarEmbedPaymentMethod } from './payment-method'

const ALLOWED_ORIGIN = 'http://127.0.0.1:3000'
const CUSTOMER_SESSION_TOKEN = 'polar_cst_test_token'

beforeAll(() => {
  // @ts-expect-error - Global defined at build time by tsup
  globalThis.__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ = ALLOWED_ORIGIN
})

const cleanupDom = () => {
  document.querySelectorAll('iframe').forEach((el) => el.remove())
  document.querySelectorAll('style').forEach((el) => el.remove())
  document.querySelectorAll('div').forEach((el) => el.remove())
  document.body.classList.remove('polar-no-scroll')
}

const dispatchLoaded = () => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: ALLOWED_ORIGIN,
      data: { type: 'POLAR_PAYMENT_METHOD', event: 'loaded' },
    }),
  )
}

describe('PolarEmbedPaymentMethod', () => {
  describe('postMessage', () => {
    it('posts a message to the parent window with the correct type', () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

      PolarEmbedPaymentMethod.postMessage({ event: 'loaded' }, ALLOWED_ORIGIN)

      expect(postMessageSpy).toHaveBeenCalledWith(
        { event: 'loaded', type: 'POLAR_PAYMENT_METHOD' },
        ALLOWED_ORIGIN,
      )

      postMessageSpy.mockRestore()
    })

    it('includes event data for success messages', () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

      PolarEmbedPaymentMethod.postMessage(
        { event: 'success', paymentMethodId: 'pm_123' },
        ALLOWED_ORIGIN,
      )

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          event: 'success',
          paymentMethodId: 'pm_123',
          type: 'POLAR_PAYMENT_METHOD',
        },
        ALLOWED_ORIGIN,
      )

      postMessageSpy.mockRestore()
    })
  })

  describe('create', () => {
    afterEach(cleanupDom)

    it('creates an iframe with the correct src and modal mode', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')
      expect(iframe).not.toBeNull()

      const src = new URL(iframe!.src)
      expect(src.pathname).toBe('/embed/payment-method')
      expect(src.origin).toBe(ALLOWED_ORIGIN)
      expect(src.searchParams.get('session_token')).toBe(CUSTOMER_SESSION_TOKEN)
      expect(src.searchParams.get('embed')).toBe('true')
      expect(src.searchParams.get('embed_origin')).toBe(window.location.origin)
      expect(src.searchParams.get('mode')).toBe('modal')

      embed.close()
    })

    it('sets theme query parameter when provided', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
        theme: 'dark',
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')
      const src = new URL(iframe!.src)
      expect(src.searchParams.get('theme')).toBe('dark')

      embed.close()
    })

    it('sets set_default=false when setAsDefault is explicitly false', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
        setAsDefault: false,
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')!
      expect(new URL(iframe.src).searchParams.get('set_default')).toBe('false')

      embed.close()
    })

    it('omits set_default URL param by default', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')!
      expect(new URL(iframe.src).searchParams.get('set_default')).toBeNull()

      embed.close()
    })

    it('forwards a member token verbatim — no client-side type sniffing', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: 'polar_mst_test_member',
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')!
      const src = new URL(iframe.src)
      expect(src.searchParams.get('session_token')).toBe(
        'polar_mst_test_member',
      )

      embed.close()
    })

    it('adds polar-no-scroll class to body', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      dispatchLoaded()
      const embed = await promise
      embed.close()
    })

    it('calls onLoaded callback when the embed loads', async () => {
      const onLoaded = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
        onLoaded,
      })

      dispatchLoaded()
      const embed = await promise

      expect(onLoaded).toHaveBeenCalledTimes(1)
      embed.close()
    })
  })

  describe('close', () => {
    afterEach(cleanupDom)

    it('removes the iframe from the DOM', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      expect(document.querySelector('iframe')).not.toBeNull()
      embed.close()
      expect(document.querySelector('iframe')).toBeNull()
    })

    it('removes polar-no-scroll class from body', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.close()

      expect(document.body.classList.contains('polar-no-scroll')).toBe(false)
    })
  })

  describe('event handling', () => {
    afterEach(cleanupDom)

    it('dispatches close event and removes iframe', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).toBeNull()
      embed.close()
    })

    it('prevents close after confirmed event', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'confirmed' },
        }),
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()
      embed.close()
    })

    it('auto-closes the modal on success', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'confirmed' },
        }),
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_PAYMENT_METHOD',
            event: 'success',
            paymentMethodId: 'pm_123',
          },
        }),
      )

      expect(document.querySelector('iframe')).toBeNull()
      embed.close()
    })

    it('skips the default auto-close when success listener calls preventDefault', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('success', (event) => event.preventDefault())

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_PAYMENT_METHOD',
            event: 'success',
            paymentMethodId: 'pm_123',
          },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()
      embed.close()
    })

    it('forwards success event detail to listeners', async () => {
      const successListener = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('success', successListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_PAYMENT_METHOD',
            event: 'success',
            paymentMethodId: 'pm_abc',
          },
        }),
      )

      expect(successListener).toHaveBeenCalledTimes(1)
      const event = successListener.mock.calls[0][0] as CustomEvent
      expect(event.detail.paymentMethodId).toBe('pm_abc')

      embed.close()
    })

    it('forwards error event detail to listeners', async () => {
      const errorListener = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('error', errorListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_PAYMENT_METHOD',
            event: 'error',
            code: 'unauthorized',
          },
        }),
      )

      expect(errorListener).toHaveBeenCalledTimes(1)
      expect((errorListener.mock.calls[0][0] as CustomEvent).detail.code).toBe(
        'unauthorized',
      )

      embed.close()
    })

    it('silently drops resize messages in modal mode', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise

      const iframe = document.querySelector('iframe')!
      const heightBefore = iframe.style.height

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: {
            type: 'POLAR_PAYMENT_METHOD',
            event: 'resize',
            height: 480,
          },
        }),
      )

      expect(iframe.style.height).toBe(heightBefore)
      embed.close()
    })

    it('ignores messages from disallowed origins', async () => {
      const closeListener = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('close', closeListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.com',
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'close' },
        }),
      )

      expect(closeListener).not.toHaveBeenCalled()
      expect(document.querySelector('iframe')).not.toBeNull()

      embed.close()
    })

    it('ignores messages with the wrong type', async () => {
      const closeListener = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('close', closeListener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_CHECKOUT', event: 'close' },
        }),
      )

      expect(closeListener).not.toHaveBeenCalled()
      embed.close()
    })

    it('skips the default close action when preventDefault is called', async () => {
      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('close', (event) => event.preventDefault())

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'close' },
        }),
      )

      expect(document.querySelector('iframe')).not.toBeNull()
      embed.close()
    })
  })

  describe('addEventListener / removeEventListener', () => {
    afterEach(cleanupDom)

    it('removes event listeners', async () => {
      const listener = vi.fn()

      const promise = PolarEmbedPaymentMethod.create({
        sessionToken: CUSTOMER_SESSION_TOKEN,
      })

      dispatchLoaded()
      const embed = await promise
      embed.addEventListener('confirmed', listener)
      embed.removeEventListener('confirmed', listener)

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ALLOWED_ORIGIN,
          data: { type: 'POLAR_PAYMENT_METHOD', event: 'confirmed' },
        }),
      )

      expect(listener).not.toHaveBeenCalled()
      embed.close()
    })
  })

  describe('init', () => {
    afterEach(() => {
      document
        .querySelectorAll('[data-polar-payment-method]')
        .forEach((el) => el.remove())
      cleanupDom()
    })

    it('attaches click handlers that open the embed with the token', () => {
      const button = document.createElement('button')
      button.setAttribute('data-polar-payment-method', CUSTOMER_SESSION_TOKEN)
      document.body.appendChild(button)

      PolarEmbedPaymentMethod.init()

      button.click()

      const iframe = document.querySelector('iframe')
      expect(iframe).not.toBeNull()
      const src = new URL(iframe!.src)
      expect(src.searchParams.get('session_token')).toBe(CUSTOMER_SESSION_TOKEN)
    })

    it('reads theme from data-polar-payment-method-theme', () => {
      const button = document.createElement('button')
      button.setAttribute('data-polar-payment-method', CUSTOMER_SESSION_TOKEN)
      button.setAttribute('data-polar-payment-method-theme', 'dark')
      document.body.appendChild(button)

      PolarEmbedPaymentMethod.init()
      button.click()

      const iframe = document.querySelector('iframe')
      const src = new URL(iframe!.src)
      expect(src.searchParams.get('theme')).toBe('dark')
    })

    it('does nothing when the data attribute is empty', () => {
      const button = document.createElement('button')
      button.setAttribute('data-polar-payment-method', '')
      document.body.appendChild(button)

      PolarEmbedPaymentMethod.init()
      button.click()

      expect(document.querySelector('iframe')).toBeNull()
    })
  })

  describe('window.Polar', () => {
    it('exposes EmbedPaymentMethod on window.Polar', () => {
      expect(window.Polar).toBeDefined()
      expect(window.Polar.EmbedPaymentMethod).toBe(PolarEmbedPaymentMethod)
    })
  })
})
