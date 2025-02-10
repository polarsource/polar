import { schemas } from '@polar-sh/client'
import { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'

type ValidationErrorsMap = Record<string, string[]>

export const getValidationErrorsMap = (
  errors: schemas['ValidationError'][],
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
  errors: schemas['ValidationError'][],
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
