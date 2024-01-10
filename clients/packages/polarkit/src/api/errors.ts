import { ResponseError, ValidationError } from '@polar-sh/sdk'
import { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'

type ValidationErrorsMap = Record<string, string[]>

export const getValidationErrorsMap = (
  errors: ValidationError[],
): ValidationErrorsMap => {
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

export const setValidationErrors = <TFieldValues extends FieldValues>(
  errors: ValidationError[],
  setError: UseFormSetError<TFieldValues>,
): void => {
  errors.forEach((error) => {
    const loc = error.loc.slice(1).join('.') as FieldPath<TFieldValues>
    setError(loc, {
      type: error.type,
      message: error.msg,
    })
  })
}

export type DetailError = {
  detail: string
  type: 'BadRequest' | string
}

export const toDetailError = async (
  e: any,
): Promise<DetailError | undefined> => {
  if (!(e instanceof ResponseError)) {
    return undefined
  }

  const js = await e.response.json()
  if (js['detail'] && js['type']) {
    return js as DetailError
  }

  return undefined
}
