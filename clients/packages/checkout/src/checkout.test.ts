import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PolarEmbedCheckout } from './checkout'

const ALLOWED_ORIGIN = 'http://127.0.0.1:3000'

beforeAll(() => {
  // Define the build-time global that embed.ts expects
  // @ts-expect-error - Global defined at build time by tsup
  globalThis.__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ = ALLOWED_ORIGIN
})

// Dispatch a POLAR_CHECKOUT message as if it came from the embedded checkout
// iframe identified by `source`. The embed script now ignores any message
// whose `event.source` does not match the owning iframe's `contentWindow`, so
// every dispatched message must carry the correct source to reach the
// instance it belongs to.
const dispatchMessage = (
  data: unknown,
  source: Window | null,
  origin: string = ALLOWED_ORIGIN,
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin,
      source: source ?? undefined,
      data,
    }),
  )
}

// Grab the contentWindow of the iframe backing the most recently created
// embedded checkout. `create()` appends the iframe to the body synchronously
// before returning, so this is safe to call immediately afterwards.
const latestIframeSource = (): Window => {
  const iframe = document.querySelector('iframe') as HTMLIFrameElement
  return iframe.contentWindow as Window
}

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
      const source = latestIframeSource()

      // Simulate the loaded event from the iframe
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

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

      const source = latestIframeSource()
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.close()
    })

    it('calls onLoaded callback when checkout loads', async () => {
      const onLoaded = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
        { onLoaded },
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()

      expect(document.querySelector('iframe')).toBeNull()
    })

    it('removes polar-no-scroll class from body', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.close()

      expect(document.body.classList.contains('polar-no-scroll')).toBe(false)
    })

    it('is idempotent: calling close twice does not over-decrement the body class refcount', async () => {
      // Open two checkouts, then close one twice. The second call must NOT
      // decrement the shared polar-no-scroll refcount below the count of
      // still-open instances — otherwise the scroll lock would be dropped
      // while another checkout is still on screen.
      const promise1 = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_1',
      )
      const promise2 = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_2',
      )
      const iframes = document.querySelectorAll('iframe')
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'loaded' },
        iframes[0]!.contentWindow,
      )
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'loaded' },
        iframes[1]!.contentWindow,
      )
      const [c1, c2] = await Promise.all([promise1, promise2])

      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      c1.close()
      c1.close() // idempotent

      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      c2.close()

      expect(document.body.classList.contains('polar-no-scroll')).toBe(false)
      expect(document.querySelectorAll('iframe').length).toBe(0)
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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

      expect(document.querySelector('iframe')).toBeNull()

      // Clean up listeners
      checkout.close()
    })

    it('prevents close after confirmed event', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise

      // Confirm — should prevent closing
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

      // Try to close via event — should be blocked
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

      expect(document.querySelector('iframe')).not.toBeNull()

      // Force cleanup
      checkout.close()
    })

    it('ignores messages from disallowed origins', async () => {
      const closeListener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('close', closeListener)

      // Correct source but disallowed origin: source check passes, origin
      // check must still reject the message.
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'close' },
        source,
        'https://evil.com',
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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('close', closeListener)

      dispatchMessage({ type: 'SOME_OTHER_EVENT', event: 'close' }, source)

      expect(closeListener).not.toHaveBeenCalled()

      checkout.close()
    })

    it('ignores messages whose source is not this instance iframe', async () => {
      // A message that arrives with the correct origin and shape but from a
      // DIFFERENT window (e.g. another Polar checkout iframe on the page, or
      // a null source) must not be dispatched onto this instance's bus or
      // mutate its state.
      const closeListener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('close', closeListener)

      // null source
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, null)

      // source from a foreign iframe
      const foreignIframe = document.createElement('iframe')
      document.body.appendChild(foreignIframe)
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'close' },
        foreignIframe.contentWindow,
      )
      foreignIframe.remove()

      expect(closeListener).not.toHaveBeenCalled()
      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('skips the default loaded action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
        { onLoaded: (event) => event.preventDefault() },
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('close', (event) => event.preventDefault())

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('skips the default confirmed action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('confirmed', (event) => event.preventDefault())

      // Confirm — but listener prevents default, so closable should stay true.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

      // Close should still work since closable was not flipped to false.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

      expect(document.querySelector('iframe')).toBeNull()
    })

    it('skips the default success action when preventDefault is called', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise

      // Lock closing first, then dispatch success with a listener that
      // prevents default — closing must remain locked because the default
      // action (re-enabling closing) was skipped.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

      checkout.addEventListener('success', (event) => event.preventDefault())

      dispatchMessage(
        {
          type: 'POLAR_CHECKOUT',
          event: 'success',
          successURL: 'https://example.com/thanks',
          redirect: false,
        },
        source,
      )

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

      expect(document.querySelector('iframe')).not.toBeNull()

      checkout.close()
    })

    it('re-enables closing after success event', async () => {
      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise

      // Confirm to lock closing
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

      // Success with redirect=false should re-enable closing
      dispatchMessage(
        {
          type: 'POLAR_CHECKOUT',
          event: 'success',
          successURL: 'https://example.com/thanks',
          redirect: false,
        },
        source,
      )

      // Now close should work again
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, source)

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
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('confirmed', listener)

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

      expect(listener).toHaveBeenCalledTimes(1)

      checkout.close()
    })

    it('removes event listeners', async () => {
      const listener = vi.fn()

      const promise = PolarEmbedCheckout.create(
        'https://buy.polar.sh/polar_cl_123',
      )
      const source = latestIframeSource()

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, source)

      const checkout = await promise
      checkout.addEventListener('confirmed', listener)
      checkout.removeEventListener('confirmed', listener)

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, source)

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

    it('attaches click handlers to elements with data-polar-checkout', async () => {
      const link = document.createElement('a')
      link.href = 'https://buy.polar.sh/polar_cl_123'
      link.setAttribute('data-polar-checkout', '')
      document.body.appendChild(link)

      PolarEmbedCheckout.init()

      link.click()

      const iframe = document.querySelector('iframe')
      expect(iframe).not.toBeNull()

      // Tear down the checkout that the click created so the shared
      // polar-no-scroll refcount is balanced before the next test.
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'close' },
        (iframe as HTMLIFrameElement).contentWindow,
      )

      // Let the async click handler settle.
      await Promise.resolve()
    })
  })

  describe('multiple concurrent instances', () => {
    afterEach(() => {
      document.querySelectorAll('iframe').forEach((el) => el.remove())
      document.querySelectorAll('style').forEach((el) => el.remove())
      document.querySelectorAll('div').forEach((el) => el.remove())
      document.body.classList.remove('polar-no-scroll')
    })

    const createTwo = async (
      options?: {
        onLoaded1?: (event: CustomEvent) => void
        onLoaded2?: (event: CustomEvent) => void
      },
      url1 = 'https://buy.polar.sh/polar_cl_1',
      url2 = 'https://buy.polar.sh/polar_cl_2',
    ) => {
      const p1 = PolarEmbedCheckout.create(
        url1,
        options?.onLoaded1 ? { onLoaded: options.onLoaded1 } : undefined,
      )
      const p2 = PolarEmbedCheckout.create(
        url2,
        options?.onLoaded2 ? { onLoaded: options.onLoaded2 } : undefined,
      )

      const iframes = document.querySelectorAll('iframe')
      const s1 = iframes[0]!.contentWindow as Window
      const s2 = iframes[1]!.contentWindow as Window

      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s1)
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s2)

      const [c1, c2] = await Promise.all([p1, p2])
      return { c1, c2, s1, s2 }
    }

    it('routes a loaded message only to the iframe that sent it', async () => {
      const onLoaded1 = vi.fn()
      const onLoaded2 = vi.fn()

      const p1 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_1', {
        onLoaded: onLoaded1,
      })
      const p2 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_2', {
        onLoaded: onLoaded2,
      })
      const iframes = document.querySelectorAll('iframe')
      const s1 = iframes[0]!.contentWindow as Window
      const s2 = iframes[1]!.contentWindow as Window

      // Only iframe #1 reports it has loaded.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s1)

      // onLoaded1 fires; onLoaded2 does NOT — the message is not cross-talked
      // onto instance #2's bus.
      expect(onLoaded1).toHaveBeenCalledTimes(1)
      expect(onLoaded2).not.toHaveBeenCalled()

      // p2 is still pending (its promise only resolves on its own `loaded`).
      let p2resolved = false
      p2.then(() => {
        p2resolved = true
      })
      await Promise.resolve()
      expect(p2resolved).toBe(false)

      // iframe #2 now genuinely loads — only then does onLoaded2 fire, and
      // onLoaded1 does not fire a second time.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s2)
      const [c1, c2] = await Promise.all([p1, p2])

      expect(onLoaded2).toHaveBeenCalledTimes(1)
      expect(onLoaded1).toHaveBeenCalledTimes(1)

      c1.close()
      c2.close()
    })

    it('does not let a loaded message from another iframe resolve this instance promise early', async () => {
      const p1 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_1')
      const p2 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_2')
      const iframes = document.querySelectorAll('iframe')
      const s1 = iframes[0]!.contentWindow as Window
      const s2 = iframes[1]!.contentWindow as Window

      // Only iframe #1 reports loaded — must NOT resolve p2.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s1)

      // Give the microtask queue a chance to flush.
      let p2resolved = false
      p2.then(() => {
        p2resolved = true
      })
      await Promise.resolve()
      await Promise.resolve()
      expect(p2resolved).toBe(false)

      // Now iframe #2 loads — p2 resolves correctly.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'loaded' }, s2)
      const [c1, c2] = await Promise.all([p1, p2])

      // Both loaders are gone (each instance's own `loaded` removed its
      // loader); exactly one loader spinner remains nowhere.
      expect(document.querySelectorAll('.polar-loader-spinner').length).toBe(0)

      c1.close()
      c2.close()
    })

    it('does not lock closable on another instance via a cross-talk confirmed', async () => {
      const { c1, c2, s1, s2 } = await createTwo()

      // Only instance #1 enters confirmation.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, s1)

      // A close for instance #2 must still tear instance #2 down because #2
      // never received its own `confirmed`.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s2)
      const remaining = document.querySelectorAll('iframe')
      expect(remaining.length).toBe(1)
      // The remaining iframe is instance #1's.
      expect(new URL(remaining[0]!.src).pathname).toBe('/polar_cl_1')

      // A close for instance #1 must NOT tear it down — it is locked by its OWN
      // confirmed, not by cross-talk.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s1)
      expect(document.querySelectorAll('iframe').length).toBe(1)

      // Unlock #1 via its own success and then close it.
      // Stub window.location so the success redirect does not throw in jsdom.
      const fakeLocation = {
        href: '',
        origin: ALLOWED_ORIGIN,
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      }
      const original = Object.getOwnPropertyDescriptor(window, 'location')
      Object.defineProperty(window, 'location', {
        value: fakeLocation,
        configurable: true,
        writable: true,
      })
      try {
        dispatchMessage(
          {
            type: 'POLAR_CHECKOUT',
            event: 'success',
            successURL: 'https://example.com/thanks-1',
            redirect: false,
          },
          s1,
        )
        dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s1)
        expect(document.querySelectorAll('iframe').length).toBe(0)
      } finally {
        if (original) Object.defineProperty(window, 'location', original)
      }

      c1.close()
      c2.close()
    })

    it('does not redirect the parent window from another instance success', async () => {
      const { c1, c2, s1, s2 } = await createTwo()

      const onSuccess2 = vi.fn()
      c2.addEventListener('success', onSuccess2)

      const fakeLocation = {
        href: '',
        origin: ALLOWED_ORIGIN,
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      }
      const original = Object.getOwnPropertyDescriptor(window, 'location')
      Object.defineProperty(window, 'location', {
        value: fakeLocation,
        configurable: true,
        writable: true,
      })
      try {
        // Instance #1 completes and asks the parent to redirect.
        dispatchMessage(
          {
            type: 'POLAR_CHECKOUT',
            event: 'success',
            successURL: 'https://example.com/thanks-1',
            redirect: true,
          },
          s1,
        )

        // The redirect is applied exactly once by instance #1's handler.
        expect(fakeLocation.href).toBe('https://example.com/thanks-1')

        // Instance #2 did not process instance #1's success.
        expect(onSuccess2).not.toHaveBeenCalled()

        // Instance #2 is still open.
        expect(document.querySelectorAll('iframe').length).toBe(2)

        // And instance #2 can still close afterwards (its closable was not
        // mutated by #1's success).
        dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s2)
        expect(document.querySelectorAll('iframe').length).toBe(1)
      } finally {
        if (original) Object.defineProperty(window, 'location', original)
      }

      c1.close()
      c2.close()
    })

    it('keeps polar-no-scroll while any instance is open and removes it only when the last closes', async () => {
      const p1 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_1')
      const p2 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_2')
      const p3 = PolarEmbedCheckout.create('https://buy.polar.sh/polar_cl_3')
      const iframes = document.querySelectorAll('iframe')
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'loaded' },
        iframes[0]!.contentWindow,
      )
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'loaded' },
        iframes[1]!.contentWindow,
      )
      dispatchMessage(
        { type: 'POLAR_CHECKOUT', event: 'loaded' },
        iframes[2]!.contentWindow,
      )
      const [c1, c2, c3] = await Promise.all([p1, p2, p3])

      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      c1.close()
      expect(document.querySelectorAll('iframe').length).toBe(2)
      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      c3.close()
      expect(document.querySelectorAll('iframe').length).toBe(1)
      expect(document.body.classList.contains('polar-no-scroll')).toBe(true)

      c2.close()
      expect(document.querySelectorAll('iframe').length).toBe(0)
      expect(document.body.classList.contains('polar-no-scroll')).toBe(false)
    })

    it('ignores messages dispatched by another Polar iframe that is not its own', async () => {
      const { c1, c2, s1, s2 } = await createTwo()

      const onConfirmed1 = vi.fn()
      const onConfirmed2 = vi.fn()
      c1.addEventListener('confirmed', onConfirmed1)
      c2.addEventListener('confirmed', onConfirmed2)

      // `confirmed` from instance #2 must reach instance #2 only.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'confirmed' }, s2)

      expect(onConfirmed2).toHaveBeenCalledTimes(1)
      expect(onConfirmed1).not.toHaveBeenCalled()

      // Instance #1 is still closable (it never received its own `confirmed`),
      // instance #2 is locked.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s1)
      const remaining = document.querySelectorAll('iframe')
      expect(remaining.length).toBe(1)
      expect(new URL(remaining[0]!.src).pathname).toBe('/polar_cl_2')

      // Instance #2 cannot close because of its own `confirmed`.
      dispatchMessage({ type: 'POLAR_CHECKOUT', event: 'close' }, s2)
      expect(document.querySelectorAll('iframe').length).toBe(1)

      c1.close()
      c2.close()
    })
  })

  describe('window.Polar', () => {
    it('exposes EmbedCheckout on window.Polar', () => {
      expect(window.Polar).toBeDefined()
      expect(window.Polar.EmbedCheckout).toBe(PolarEmbedCheckout)
    })
  })
})
