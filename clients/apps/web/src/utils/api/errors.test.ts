import { describe, expect, it, vi } from 'vitest'
import { findFirstErrorMessage, setProductValidationErrors } from './errors'

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
