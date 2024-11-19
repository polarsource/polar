import React from 'react'

export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies?: any[],
) => {
  const timeout = React.useRef<NodeJS.Timeout>()

  return React.useCallback(
    (...args: Parameters<T>): ReturnType<T> | void => {
      if (timeout.current != null) {
        clearTimeout(timeout.current)
      }

      timeout.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...(dependencies ? dependencies : [])],
  )
}

export default useDebouncedCallback
