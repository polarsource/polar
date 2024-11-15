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
  slice: number = 1,
  discriminators?: string[] | undefined,
): void => {
  errors.forEach((error) => {
    let loc = error.loc.slice(slice)
    if (discriminators && discriminators.includes(loc[0] as string)) {
      loc = loc.slice(1)
    }
    setError(loc.join('.') as FieldPath<TFieldValues>, {
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
