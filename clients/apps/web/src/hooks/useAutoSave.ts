import { useEffect, useRef } from 'react'
import { FieldValues, UseFormReturn } from 'react-hook-form'

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
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const isSavingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Filter on type === 'change' so programmatic updates like `reset()`
    // (fired after a successful save) don't re-trigger the autosave loop.
    const subscription = form.watch((_value, info) => {
      if (info.type !== 'change') return
      if (isSavingRef.current) return

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(async () => {
        if (isSavingRef.current) return

        isSavingRef.current = true
        try {
          await onSaveRef.current(form.getValues())
        } catch {
          // Swallow: consumers handle their own errors via onSave.
        } finally {
          isSavingRef.current = false
        }
      }, delay)
    })

    return () => {
      subscription.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [form, delay, enabled])
}
