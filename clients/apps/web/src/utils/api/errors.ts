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
