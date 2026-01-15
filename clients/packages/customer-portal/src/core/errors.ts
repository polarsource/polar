export interface ValidationErrorItem {
  type: string
  loc: (string | number)[]
  msg: string
  input?: unknown
}

export class PolarCustomerPortalError extends Error {
  code: string
  status: number
  detail?: unknown

  constructor(options: {
    message: string
    code: string
    status: number
    detail?: unknown
  }) {
    super(options.message)
    this.name = 'PolarCustomerPortalError'
    this.code = options.code
    this.status = options.status
    this.detail = options.detail
  }

  static fromResponse(
    error: unknown,
    response: Response,
  ): PolarCustomerPortalError {
    const errorObj = error as Record<string, unknown>
    const detail = errorObj?.detail

    if (response.status === 422 && Array.isArray(detail)) {
      return new ValidationError(detail)
    }

    return new PolarCustomerPortalError({
      message: typeof detail === 'string' ? detail : 'An error occurred',
      code: (errorObj?.type as string) || 'unknown_error',
      status: response.status,
      detail,
    })
  }
}

export class ValidationError extends PolarCustomerPortalError {
  errors: ValidationErrorItem[]

  constructor(errors: ValidationErrorItem[]) {
    super({
      message: errors[0]?.msg || 'Validation error',
      code: 'validation_error',
      status: 422,
      detail: errors,
    })
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return (
    error != null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ValidationError' &&
    'errors' in error &&
    Array.isArray(error.errors)
  )
}

export class UnauthorizedError extends PolarCustomerPortalError {
  constructor(message = 'Unauthorized') {
    super({
      message,
      code: 'unauthorized',
      status: 401,
    })
    this.name = 'UnauthorizedError'
  }
}

export class RateLimitError extends PolarCustomerPortalError {
  constructor(message = 'Too many requests') {
    super({
      message,
      code: 'rate_limit_exceeded',
      status: 429,
    })
    this.name = 'RateLimitError'
  }
}
