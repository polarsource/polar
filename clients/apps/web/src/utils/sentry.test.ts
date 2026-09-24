import type { ErrorEvent } from '@sentry/nextjs'
import { describe, expect, it } from 'vitest'
import { isInjectedScriptError } from './sentry'

const event = (filenames: (string | undefined)[]): ErrorEvent => ({
  type: undefined,
  exception: {
    values: [
      {
        stacktrace: { frames: filenames.map((filename) => ({ filename })) },
      },
    ],
  },
})

describe('isInjectedScriptError', () => {
  it.each([
    ['extension executor', ['app:///executors/200.js'], true],
    ['wallet provider', ['app:///inpage.js', 'app:///inpage.js'], true],
    ['userscript', ['app:///userscript.html'], true],
    ['injected bundle', ['app:///out/mises_safe_injected.bundle.js'], true],
    ['our bundle', ['app:///_next/static/chunks/abc.js'], false],
    [
      'our bundle calling an injected script',
      ['app:///inpage.js', 'app:///_next/static/chunks/abc.js'],
      false,
    ],
    ['Stripe.js', ['app:///clover/stripe.js'], false],
    ['inline script in our page', ['app:///checkout/polar_c_abc'], false],
    ['frame without a filename', [undefined], false],
    ['no frames', [], false],
  ])('%s → %s', (_, filenames, expected) => {
    expect(isInjectedScriptError(event(filenames))).toBe(expected)
  })
})
