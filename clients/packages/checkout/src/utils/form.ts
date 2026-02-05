import type { ValidationError } from '@spaire/sdk/models/components/validationerror'
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

    // Transform each loc to camelCase, since the schema from our SDK converts everythng to camelCase
    for (let i = 0; i < loc.length; i++) {
      if (Number.isInteger(loc[i])) {
        continue
      }

      loc[i] = (loc[i] as string).replace(/_([a-z])/g, (g) =>
        g[1].toUpperCase(),
      )

      // Don't camel case customFieldData properties, as they are dynamic and non converted to camelCase
      if (loc[i] === 'customFieldData') {
        break
      }
    }

    setError(loc.join('.') as FieldPath<TFieldValues>, {
      type: error.type,
      message: error.msg,
    })
  })
}
