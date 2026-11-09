import { useEffect, useRef } from 'react'
import { FieldValues, UseFormReturn } from 'react-hook-form'

interface UseAutoSaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>
  onSave: (data: T) => Promise<T | undefined>
  delay?: number
}

export function useAutoSave<T extends FieldValues>({
  form,
  onSave,
  delay = 1000,
}: UseAutoSaveOptions<T>) {
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const isSavingRef = useRef(false)
  const hasPendingChangesRef = useRef(false)
  const flushRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    let active = true
    let timeout: ReturnType<typeof setTimeout> | null = null
    const flush = async () => {
      if (isSavingRef.current || !hasPendingChangesRef.current) return

      hasPendingChangesRef.current = false
      isSavingRef.current = true
      try {
        const savedValues = await onSaveRef.current(form.getValues())
        if (
          active &&
          savedValues !== undefined &&
          !hasPendingChangesRef.current
        ) {
          form.reset(savedValues)
        }
      } catch {
        // Swallow: consumers handle their own errors via onSave.
      } finally {
        isSavingRef.current = false
        if (active && hasPendingChangesRef.current && timeout === null) {
          void flushRef.current?.()
        }
      }
    }
    flushRef.current = flush

    const scheduleFlush = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        timeout = null
        void flushRef.current?.()
      }, delay)
    }

    // `reset()` emits without a `name`; `field.onChange` and `setValue` both
    // set one. Filtering on `name` keeps programmatic setValue updates (e.g.
    // file uploads) while still ignoring the reset fired after a save.
    const subscription = form.watch((_value, info) => {
      if (!info.name) return

      hasPendingChangesRef.current = true
      scheduleFlush()
    })

    return () => {
      active = false
      subscription.unsubscribe()
      hasPendingChangesRef.current = false
      if (timeout) clearTimeout(timeout)
      if (flushRef.current === flush) flushRef.current = null
    }
  }, [form, delay])
}
