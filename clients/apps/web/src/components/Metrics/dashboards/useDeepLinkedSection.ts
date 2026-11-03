import { useEffect, useRef, useState } from 'react'

const readHash = () => window.location.hash.slice(1) || null

// Sections can mount after the page does (custom dashboards load async), so
// the scroll is retried whenever `sectionIds` changes until the target exists.
export const useDeepLinkedSection = (sectionIds: string[]) => {
  const [section, setSection] = useState<string | null>(null)
  const scrolledToSection = useRef<string | null>(null)

  useEffect(() => {
    const onHashChange = () => setSection(readHash())
    onHashChange()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!section || scrolledToSection.current === section) return
    const target = document.getElementById(section)
    if (!target) return
    target.scrollIntoView({ block: 'start' })
    scrolledToSection.current = section
  }, [section, sectionIds])

  return section
}
