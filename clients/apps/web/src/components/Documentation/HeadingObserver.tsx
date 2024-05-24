'use client'

import { ComponentProps, createElement, useEffect, useRef } from 'react'
import { useDocumentationContext } from './DocumentationProvider'

type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

interface HeadingObserverProps extends ComponentProps<Heading> {
  type: Heading
}

export const HeadingObserver = ({ type, ...props }: HeadingObserverProps) => {
  const ref = useRef<HTMLHeadingElement>(null)

  const { setIntersectingToCEntries } = useDocumentationContext()

  useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIntersectingToCEntries((e) => {
            if (entry.isIntersecting) {
              return [...e, entry.target.id]
            } else {
              return e.filter((id) => id !== entry.target.id)
            }
          })
        },
        {
          rootMargin: '0px',
          threshold: 0.5,
        },
      )

      observer.observe(ref.current)

      return () => {
        observer.disconnect()
      }
    }
  }, [setIntersectingToCEntries])

  return createElement(type, {
    ref,
    ...props,
  })
}
