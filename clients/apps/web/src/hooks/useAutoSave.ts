import { useEffect, useState } from 'react'
import { FieldValues, UseFormReturn, useWatch } from 'react-hook-form'
import { useDebouncedCallback } from './utils'

interface UseAutoSaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>
  onSave: (data: T) => Promise<void>
  delay?: number
  enabled?: boolean
}

export function useAutoSave<T extends FieldValues>({
  form,
  onSave,
  delay = 1000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false)

  const { control, formState } = form
  const { isDirty } = formState
  const formValues = useWatch({ control })

  const debouncedSave = useDebouncedCallback(
    async () => {
      setIsSaving(true)
      try {
        const data = form.getValues()
        await onSave(data)
      } finally {
        setIsSaving(false)
      }
    },
    delay,
    [onSave, form],
  )

  useEffect(() => {
    if (!enabled || !isDirty || isSaving) {
      return
    }

    debouncedSave()
  }, [formValues, enabled, isDirty, debouncedSave, isSaving])

  return { isSaving }
}
