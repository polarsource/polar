import { describe, expect, it } from 'vitest'
import {
  isValidationError,
  PolarCustomerPortalError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from './errors'

describe('PolarCustomerPortalError', () => {
  it('creates error with all properties', () => {
    const error = new PolarCustomerPortalError({
      message: 'Something went wrong',
      code: 'validation_error',
      status: 400,
      detail: 'Invalid email format',
    })

    expect(error.message).toBe('Something went wrong')
    expect(error.code).toBe('validation_error')
    expect(error.status).toBe(400)
    expect(error.detail).toBe('Invalid email format')
    expect(error.name).toBe('PolarCustomerPortalError')
  })

  it('extends Error', () => {
    const error = new PolarCustomerPortalError({
      message: 'Test error',
      code: 'test',
      status: 500,
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PolarCustomerPortalError)
  })

  describe('fromResponse', () => {
    it('creates error from API response with string detail', () => {
      const apiError = {
        type: 'not_found',
        detail: 'Resource not found',
      }
      const response = new Response(null, { status: 404 })

      const error = PolarCustomerPortalError.fromResponse(apiError, response)

      expect(error.message).toBe('Resource not found')
      expect(error.code).toBe('not_found')
      expect(error.status).toBe(404)
      expect(error.detail).toBe('Resource not found')
    })

    it('creates ValidationError for 422 responses', () => {
      const apiError = {
        type: 'validation_error',
        detail: [
          { type: 'invalid', loc: ['body', 'email'], msg: 'Invalid email' },
        ],
      }
      const response = new Response(null, { status: 422 })

      const error = PolarCustomerPortalError.fromResponse(apiError, response)

      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe('Invalid email')
      expect(error.status).toBe(422)
      expect((error as ValidationError).errors).toEqual(apiError.detail)
    })

    it('uses default code when type is missing', () => {
      const apiError = { detail: 'Some error' }
      const response = new Response(null, { status: 500 })

      const error = PolarCustomerPortalError.fromResponse(apiError, response)

      expect(error.code).toBe('unknown_error')
    })
  })
})

describe('UnauthorizedError', () => {
  it('creates error with default message', () => {
    const error = new UnauthorizedError()

    expect(error.message).toBe('Unauthorized')
    expect(error.code).toBe('unauthorized')
    expect(error.status).toBe(401)
    expect(error.name).toBe('UnauthorizedError')
  })

  it('creates error with custom message', () => {
    const error = new UnauthorizedError('Token expired')

    expect(error.message).toBe('Token expired')
    expect(error.code).toBe('unauthorized')
    expect(error.status).toBe(401)
  })

  it('extends PolarCustomerPortalError', () => {
    const error = new UnauthorizedError()

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PolarCustomerPortalError)
    expect(error).toBeInstanceOf(UnauthorizedError)
  })
})

describe('RateLimitError', () => {
  it('creates error with default message', () => {
    const error = new RateLimitError()

    expect(error.message).toBe('Too many requests')
    expect(error.code).toBe('rate_limit_exceeded')
    expect(error.status).toBe(429)
    expect(error.name).toBe('RateLimitError')
  })

  it('creates error with custom message', () => {
    const error = new RateLimitError('Slow down!')

    expect(error.message).toBe('Slow down!')
    expect(error.code).toBe('rate_limit_exceeded')
    expect(error.status).toBe(429)
  })

  it('extends PolarCustomerPortalError', () => {
    const error = new RateLimitError()

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PolarCustomerPortalError)
    expect(error).toBeInstanceOf(RateLimitError)
  })
})

describe('ValidationError', () => {
  it('creates error with validation errors', () => {
    const errors = [
      { type: 'invalid', loc: ['body', 'email'], msg: 'Invalid email' },
      { type: 'missing', loc: ['body', 'name'], msg: 'Required' },
    ]
    const error = new ValidationError(errors)

    expect(error.message).toBe('Invalid email')
    expect(error.code).toBe('validation_error')
    expect(error.status).toBe(422)
    expect(error.name).toBe('ValidationError')
    expect(error.errors).toEqual(errors)
  })

  it('extends PolarCustomerPortalError', () => {
    const error = new ValidationError([
      { type: 'invalid', loc: ['body', 'field'], msg: 'Invalid' },
    ])

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PolarCustomerPortalError)
    expect(error).toBeInstanceOf(ValidationError)
  })
})

describe('isValidationError', () => {
  it('returns true for ValidationError instances', () => {
    const error = new ValidationError([
      { type: 'invalid', loc: ['body', 'field'], msg: 'Invalid' },
    ])
    expect(isValidationError(error)).toBe(true)
  })

  it('returns true for plain objects with correct shape', () => {
    const error = {
      name: 'ValidationError',
      errors: [{ type: 'invalid', loc: ['body', 'field'], msg: 'Invalid' }],
    }
    expect(isValidationError(error)).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isValidationError(new Error('test'))).toBe(false)
    expect(
      isValidationError(
        new PolarCustomerPortalError({
          message: 'test',
          code: 'test',
          status: 400,
        }),
      ),
    ).toBe(false)
    expect(isValidationError(null)).toBe(false)
    expect(isValidationError(undefined)).toBe(false)
    expect(isValidationError({ name: 'ValidationError' })).toBe(false)
  })
})
