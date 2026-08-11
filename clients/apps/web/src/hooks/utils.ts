import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
) => {
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callbackRef = useRef(callback)

  useLayoutEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(
    () => () => {
      if (timeout.current != null) {
        clearTimeout(timeout.current)
        timeout.current = undefined
      }
    },
    [],
  )

  return useCallback(
    (...args: Parameters<T>): ReturnType<T> | void => {
      if (timeout.current != null) {
        clearTimeout(timeout.current)
      }

      timeout.current = setTimeout(() => {
        timeout.current = undefined
        callbackRef.current(...args)
      }, delay)
    },
    [delay],
  )
}

export const useInViewport = <T extends HTMLElement = HTMLElement>() => {
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
