import { useState } from 'react'

export const useHasBeenSeen = <T extends HTMLElement>(
  rootMargin = '400px 0px',
) => {
  const [seen, setSeen] = useState(false)

  const ref = (node: T | null) => {
    if (!node || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }

  return { ref, seen }
}
