import { describe, expect, it } from 'vitest'
import { isExpiredCheckoutError } from './errors'

describe('isExpiredCheckoutError', () => {
  it('returns true for the ExpiredCheckoutError response body', () => {
    expect(
      isExpiredCheckoutError({
        error: 'ExpiredCheckoutError',
        detail: 'This checkout session has expired.',
      }),
    ).toBe(true)
  })

  it('returns true for the full server error envelope', () => {
    expect(
      isExpiredCheckoutError({
        type: 'error',
        status: 410,
        error: 'ExpiredCheckoutError',
        detail: 'This checkout session has expired.',
      }),
    ).toBe(true)
  })

  it.each([
    'PolarRequestValidationError',
    'RequestValidationError',
    'PaymentError',
    'AlreadyActiveSubscriptionError',
    'NotOpenCheckout',
    'PaymentNotReady',
    'DiscountRedemptionLimitReached',
    'TrialAlreadyRedeemed',
    'ResourceNotFound',
  ] as const)('returns false for %s', (errorCode) => {
    expect(
      isExpiredCheckoutError({
        error: errorCode,
        detail: `${errorCode} detail`,
      }),
    ).toBe(false)
  })

  it('returns false for a RequestValidationError with an array detail', () => {
    expect(
      isExpiredCheckoutError({
        error: 'RequestValidationError',
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'invalid',
            type: 'value_error',
            input: '',
          },
        ],
      }),
    ).toBe(false)
  })

  it('returns false for null', () => {
    expect(isExpiredCheckoutError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isExpiredCheckoutError(undefined)).toBe(false)
  })

  it('returns false for primitive values', () => {
    expect(isExpiredCheckoutError('ExpiredCheckoutError')).toBe(false)
    expect(isExpiredCheckoutError(410)).toBe(false)
    expect(isExpiredCheckoutError(true)).toBe(false)
    expect(isExpiredCheckoutError('expired')).toBe(false)
  })

  it('returns false for an Error instance', () => {
    expect(isExpiredCheckoutError(new Error('ExpiredCheckoutError'))).toBe(
      false,
    )
  })

  it('returns false for an object without an error field', () => {
    expect(isExpiredCheckoutError({ detail: 'something' })).toBe(false)
  })

  it('returns false for an object with a non-string error field', () => {
    expect(
      isExpiredCheckoutError({ error: { code: 'ExpiredCheckoutError' } }),
    ).toBe(false)
    expect(isExpiredCheckoutError({ error: 410 })).toBe(false)
    expect(isExpiredCheckoutError({ error: null })).toBe(false)
  })

  it('narrowing: the discriminator must be the exact ExpiredCheckoutError string', () => {
    expect(
      isExpiredCheckoutError({ error: 'expiredcheckouterror', detail: 'x' }),
    ).toBe(false)
    expect(
      isExpiredCheckoutError({ error: ' ExpiredCheckoutError', detail: 'x' }),
    ).toBe(false)
    expect(
      isExpiredCheckoutError({ error: 'ExpiredCheckoutError ', detail: 'x' }),
    ).toBe(false)
  })

  it('narrows the type so the discriminator is accessible', () => {
    const error: unknown = {
      error: 'ExpiredCheckoutError',
      detail: 'expired',
    }
    if (isExpiredCheckoutError(error)) {
      expect(error.error).toBe('ExpiredCheckoutError')
      expect(error.detail).toBe('expired')
    } else {
      throw new Error('expected to narrow to an expired checkout error')
    }
  })
})
