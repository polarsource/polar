import { useEffect, useState } from 'react'

export const useElementWidth = <T extends HTMLElement>() => {
  const [element, setElement] = useState<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [setElement, width] as const
}
