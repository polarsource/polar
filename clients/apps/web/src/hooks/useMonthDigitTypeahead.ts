import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook for <Select> and <SelectTrigger> to allow the user to
 * type digits (1-12) or (01-12) but still jump to the correct
 * month.
 */
export const useMonthDigitTypeahead = () => {
  const buffer = useRef('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return useCallback(
    (event: KeyboardEvent<HTMLElement>, onChange: (value: string) => void) => {
      if (event.key.length !== 1 || event.key < '0' || event.key > '9') return

      if (timer.current) clearTimeout(timer.current)
      buffer.current += event.key
      timer.current = setTimeout(() => {
        buffer.current = ''
      }, 1000)

      const parsed = parseInt(buffer.current, 10)
      if (parsed >= 1 && parsed <= 12) {
        onChange(String(parsed).padStart(2, '0'))
        event.preventDefault()
      }
    },
    [],
  )
}
