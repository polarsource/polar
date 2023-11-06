import React from 'react'

export const useDebouncedCallback = (
  callback: Function,
  delay: number,
  dependencies?: any[],
) => {
  const timeout = React.useRef<NodeJS.Timeout>()

  // Avoid error about spreading non-iterable (undefined)
  const comboDeps = dependencies
    ? [callback, delay, ...dependencies]
    : [callback, delay]

  return React.useCallback((...args: any[]) => {
    if (timeout.current != null) {
      clearTimeout(timeout.current)
    }

    timeout.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, comboDeps)
}

export default useDebouncedCallback
