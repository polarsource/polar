import { describe, expect, it, vi } from 'vitest'
import {
  extractApiErrorMessage,
  findFirstErrorMessage,
  setProductValidationErrors,
  setValidationErrors,
} from './errors'

describe('extractApiErrorMessage', () => {
  it('surfaces the first message from a 422 validation error array', () => {
    // Shape returned by submit-review when the contact email fails the
    // deliverability check (Pydantic/email-validator error).
    const error = {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'email'],
          msg: 'The domain name example.com does not accept email.',
        },
      ],
    }
    expect(extractApiErrorMessage(error)).toBe(
      'The domain name example.com does not accept email.',
    )
  })

  it('surfaces a string detail as-is', () => {
    expect(extractApiErrorMessage({ detail: 'Not permitted' })).toBe(
      'Not permitted',
    )
  })

  it('falls back when detail is missing or unexpected', () => {
    expect(extractApiErrorMessage({}, 'Please try again.')).toBe(
      'Please try again.',
    )
    expect(extractApiErrorMessage({ detail: [] }, 'Please try again.')).toBe(
      'Please try again.',
    )
  })
})

describe('findFirstErrorMessage', () => {
  it('finds message in flat error object', () => {
    const errors = { name: { type: 'required', message: 'Name is required' } }
    expect(findFirstErrorMessage(errors)).toBe('Name is required')
  })

  it('finds message in nested array field errors', () => {
    const errors = {
      prices: [
        {
          price_amount: {
            type: 'minimum_price',
            message: 'Amount must be at least $0.50',
          },
        },
      ],
    }
    expect(findFirstErrorMessage(errors)).toBe('Amount must be at least $0.50')
  })

  it('finds message in deeply nested errors', () => {
    const errors = {
      prices: [
        undefined,
        {
          price_amount: {
            type: 'minimum_price',
            message: 'Amount must be at least ₹60.00',
          },
        },
      ],
    }
    expect(findFirstErrorMessage(errors)).toBe('Amount must be at least ₹60.00')
  })

  it('returns undefined for empty object', () => {
    expect(findFirstErrorMessage({})).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(findFirstErrorMessage(null)).toBeUndefined()
    expect(findFirstErrorMessage(undefined)).toBeUndefined()
  })

  it('ignores non-string message values', () => {
    const errors = { field: { type: 'required', message: 42 } }
    expect(findFirstErrorMessage(errors)).toBeUndefined()
  })
})

describe('setProductValidationErrors', () => {
  it('maps backend error to form field path', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'minimum_price',
        loc: ['body', 'prices', 0, 'price_amount'],
        msg: 'Amount must be at least $0.50',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('prices.0.price_amount', {
      type: 'minimum_price',
      message: 'Amount must be at least $0.50',
    })
  })

  it('strips PascalCase union variant names from loc', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'minimum_price',
        loc: ['body', 'ProductCreateOneTime', 'prices', 0, 'price_amount'],
        msg: 'Amount must be at least ₹60.00',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('prices.0.price_amount', {
      type: 'minimum_price',
      message: 'Amount must be at least ₹60.00',
    })
  })

  it('strips discriminator tag names (one_time, recurring) from loc', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'minimum_price',
        loc: ['body', 'one_time', 'prices', 0, 'price_amount'],
        msg: 'Amount must be at least $0.50',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('prices.0.price_amount', {
      type: 'minimum_price',
      message: 'Amount must be at least $0.50',
    })
  })

  it('strips recurring tag name from loc', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'minimum_price',
        loc: ['body', 'recurring', 'prices', 0, 'price_amount'],
        msg: 'Amount must be at least $0.50',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('prices.0.price_amount', {
      type: 'minimum_price',
      message: 'Amount must be at least $0.50',
    })
  })

  it('strips price amount_type discriminator values in prices context', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'minimum_price',
        loc: ['body', 'prices', 0, 'fixed', 'price_amount'],
        msg: 'Amount must be at least $0.50',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('prices.0.price_amount', {
      type: 'minimum_price',
      message: 'Amount must be at least $0.50',
    })
  })

  it('skips errors with empty or invalid messages', () => {
    const setError = vi.fn()
    const errors = [
      { type: 'err', loc: ['body', 'field'], msg: '' },
      { type: 'err', loc: ['body', 'field'], msg: 'undefined' },
      { type: 'err', loc: ['body', 'field'], msg: 'null' },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).not.toHaveBeenCalled()
  })

  it('skips errors that result in empty field path', () => {
    const setError = vi.fn()
    const errors = [
      {
        type: 'err',
        loc: ['body'],
        msg: 'Some root error',
      },
    ]

    setProductValidationErrors(errors, setError)

    expect(setError).not.toHaveBeenCalled()
  })
})

describe('setValidationErrors', () => {
  it('maps discriminator-only path to root after stripping', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'fixed'],
        type: 'value_error',
        msg: 'Must specify either `amount` or `amounts`.',
      },
    ]

    setValidationErrors(errors, setError, 1, ['fixed', 'percentage'])

    expect(setError).toHaveBeenCalledWith('root', {
      type: 'value_error',
      message: 'Must specify either `amount` or `amounts`.',
    })
  })

  it('maps body-only path (empty after slice) to root', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body'],
        type: 'value_error',
        msg: 'Something went wrong at the root',
      },
    ]

    setValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('root', {
      type: 'value_error',
      message: 'Something went wrong at the root',
    })
  })

  it('does not call setError with an empty string path', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'percentage'],
        type: 'value_error',
        msg: 'Must specify either `amount` or `amounts`.',
      },
    ]

    setValidationErrors(errors, setError, 1, ['fixed', 'percentage'])

    expect(setError).not.toHaveBeenCalledWith('', expect.anything())
  })

  it('still maps non-discriminator fields within a discriminated union', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'fixed', 'amount'],
        type: 'value_error',
        msg: 'Must be greater than 0',
      },
    ]

    setValidationErrors(errors, setError, 1, ['fixed', 'percentage'])

    expect(setError).toHaveBeenCalledWith('amount', {
      type: 'value_error',
      message: 'Must be greater than 0',
    })
  })
})
