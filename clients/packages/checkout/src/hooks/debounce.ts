import { useCallback, useRef } from 'react'

// oxlint-disable-next-line typescript/no-explicit-any
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies?: unknown[],
) => {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (...args: Parameters<T>): ReturnType<T> | void => {
      if (timeout.current != null) {
        clearTimeout(timeout.current)
      }

      timeout.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...(dependencies ? dependencies : [])],
  )
}

export default useDebouncedCallback
