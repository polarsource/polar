import React, { useCallback, useRef, useState } from 'react'

export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies?: any[],
) => {
  const timeout = React.useRef<NodeJS.Timeout>(undefined)

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

export const useInViewport = <T extends HTMLElement = any>() => {
  const observer = useRef<IntersectionObserver | null>(null)
  const [inViewport, setInViewport] = useState(false)

  const ref = useCallback((node: T | null) => {
    if (typeof IntersectionObserver !== 'undefined') {
      if (node && !observer.current) {
        observer.current = new IntersectionObserver((entries) =>
          setInViewport(entries.some((entry) => entry.isIntersecting)),
        )
      } else {
        observer.current?.disconnect()
      }

      if (node) {
        observer.current?.observe(node)
      } else {
        setInViewport(false)
      }
    }
  }, [])

  return { ref, inViewport }
}
