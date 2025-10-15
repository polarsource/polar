import { useToast } from '@/components/Toast/use-toast'
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

/**
 * Product-specific validation error handler with advanced discriminated union filtering.
 * Use this for Product and ProductPrice forms that use Pydantic discriminated unions.
 * For other forms, use the simpler setValidationErrors function.
 */
export const setProductValidationErrors = <TFieldValues extends FieldValues>(
  errors: schemas['ValidationError'][],
  setError: UseFormSetError<TFieldValues>,
  slice: number = 1,
  discriminators?: string[] | undefined,
): void => {
  errors.forEach((error) => {
    // Skip errors with no message or invalid message
    if (
      !error.msg ||
      error.msg.trim() === '' ||
      error.msg === 'undefined' ||
      error.msg === 'null'
    ) {
      return
    }

    let loc = error.loc.slice(slice)

    // Filter out discriminator fields from the path
    loc = loc.filter((segment, index, array) => {
      const segmentStr = String(segment)

      // Skip if in explicit discriminators list
      if (discriminators && discriminators.includes(segmentStr)) {
        return false
      }

      // Skip Pydantic function validators (e.g., "function-after[...]")
      if (
        segmentStr.startsWith('function-after[') ||
        segmentStr.startsWith('function-before[')
      ) {
        return false
      }

      // Skip union discriminator types (PascalCase ending with "Create" or "Update")
      // These are FastAPI/Pydantic discriminated union field names
      if (
        /^[A-Z][a-zA-Z]+(Create|Update|Base)$/.test(segmentStr) &&
        !segmentStr.match(/^[A-Z]{2,}/) // Allow acronyms like "ID"
      ) {
        return false
      }

      // Skip discriminator values for ProductPriceCreate union, but ONLY in the specific context
      // After adding Discriminator("amount_type"), Pydantic includes the discriminator value in the path
      // e.g., ["prices", 0, "seat_based", "seat_tiers", "tiers"]
      // We only want to filter out "seat_based" if it appears after "prices" and a number
      const priceDiscriminatorValues = [
        'fixed',
        'custom',
        'free',
        'seat_based',
        'metered_unit',
      ]
      if (priceDiscriminatorValues.includes(segmentStr)) {
        // Check if previous segments match the pattern: "prices", then a number
        if (index >= 2) {
          const prev2 = String(array[index - 2])
          const prev1 = array[index - 1]
          // Only filter if pattern is: prices.[number].[discriminator]
          if (prev2 === 'prices' && typeof prev1 === 'number') {
            return false
          }
        }
      }

      return true
    })

    // Only set error if we have a valid field path
    if (loc.length > 0) {
      const fieldPath = loc.join('.')
      setError(fieldPath as FieldPath<TFieldValues>, {
        type: error.type,
        message: error.msg,
      })
    }
  })
}

export const apiErrorToast = (
  error:
    | schemas['HTTPValidationError']
    | schemas['ResourceNotFound']
    | schemas['NotPermitted'],
  toast: ReturnType<typeof useToast>['toast'],
  options: Parameters<ReturnType<typeof useToast>['toast']>[0] = {},
): void => {
  if (
    'error' in error &&
    (error.error === 'ResourceNotFound' || error.error === 'NotPermitted')
  ) {
    // ResourceNotFound or NotPermitted
    toast({ title: 'Error', description: error.detail, ...options })
  } else {
    // HTTPValidationError
    toast({
      title: 'Error',
      description: error.detail ? error.detail[0]?.msg : 'An error occurred',
      ...options,
    })
    return
  }
}
