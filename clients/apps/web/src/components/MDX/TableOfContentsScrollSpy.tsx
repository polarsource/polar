'use client'

import { useEffect } from 'react'

const TableOfContentsScrollSpy = ({}: {}) => {
  useEffect(() => {
    const article = document.querySelector('article')
    if (!article) return

    const headings = article.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const callback = (entries: IntersectionObserverEntry[]) => {
      const intersectingEntries = entries.filter(
        (entry) => entry.isIntersecting,
      )
      if (intersectingEntries.length === 0) return

      const activeHeading = intersectingEntries[0].target
      headings.forEach((heading) => {
        const tocEntry = document.getElementById(`toc-entry-#${heading.id}`)
        if (!tocEntry) return
        if (heading === activeHeading) {
          tocEntry.setAttribute('aria-selected', 'true')
        } else {
          tocEntry.setAttribute('aria-selected', 'false')
        }
      })
    }
    const observer = new IntersectionObserver(callback, {
      rootMargin: '0px',
      threshold: 1,
    })

    headings.forEach((heading) => observer.observe(heading))

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}

export default TableOfContentsScrollSpy
