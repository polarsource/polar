import { ValidationError } from '@polar-sh/sdk/models/components'
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'

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
