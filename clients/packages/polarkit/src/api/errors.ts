import { ApiError, ValidationError } from './client'

interface APIValidationError extends ApiError {
  body: {
    detail: ValidationError[]
  }
}

export const isValidationError = (error: ApiError): error is APIValidationError => {
  return error.status === 422
}

type ValidationErrorsMap = Record<string, string[]>;

export const getValidationErrorsMap = (errors: ValidationError[]): ValidationErrorsMap => {
  return errors.reduce<ValidationErrorsMap>((map, error) => {
    const loc = error.loc.slice(1).join('.')
    if (map[loc]) {
      return {
        ...map,
        [loc]: [...map[loc], error.msg],
      }
    }
    return {
      ...map,
      [loc]: [error.msg],
    }
  }, {})
}
