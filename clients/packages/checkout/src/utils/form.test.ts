import { describe, expect, it, vi } from 'vitest'
import { setValidationErrors } from './form'

describe('setValidationErrors', () => {
  it('calls setError for each validation error', () => {
    const setError = vi.fn()
    const errors = [
      { loc: ['body', 'email'], type: 'value_error', msg: 'Invalid email' },
      { loc: ['body', 'name'], type: 'missing', msg: 'Required' },
    ]

    setValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledTimes(2)
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'value_error',
      message: 'Invalid email',
    })
    expect(setError).toHaveBeenCalledWith('name', {
      type: 'missing',
      message: 'Required',
    })
  })

  it('uses custom slice to strip path prefix', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'data', 'field'],
        type: 'value_error',
        msg: 'Bad value',
      },
    ]

    setValidationErrors(errors, setError, 2)

    expect(setError).toHaveBeenCalledWith('field', {
      type: 'value_error',
      message: 'Bad value',
    })
  })

  it('joins nested paths with dots', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'address', 'zip_code'],
        type: 'value_error',
        msg: 'Invalid',
      },
    ]

    setValidationErrors(errors, setError)

    expect(setError).toHaveBeenCalledWith('address.zip_code', {
      type: 'value_error',
      message: 'Invalid',
    })
  })

  it('skips discriminator segments', () => {
    const setError = vi.fn()
    const errors = [
      {
        loc: ['body', 'stripe', 'card_number'],
        type: 'value_error',
        msg: 'Invalid card',
      },
    ]

    setValidationErrors(errors, setError, 1, ['stripe'])

    expect(setError).toHaveBeenCalledWith('card_number', {
      type: 'value_error',
      message: 'Invalid card',
    })
  })

  it('handles empty errors array', () => {
    const setError = vi.fn()
    setValidationErrors([], setError)
    expect(setError).not.toHaveBeenCalled()
  })

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
