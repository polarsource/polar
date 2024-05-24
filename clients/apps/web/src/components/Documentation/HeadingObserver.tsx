'use client'

import { ComponentProps, createElement, useEffect, useRef } from 'react'

type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

interface HeadingObserverProps extends ComponentProps<Heading> {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export const HeadingObserver = ({ type, ...props }: HeadingObserverProps) => {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            ref.current?.setAttribute('data-visible', 'true')
          } else {
            ref.current?.setAttribute('data-visible', 'false')
          }
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
  }, [])

  return createElement(type, {
    ref,
    ...props,
  })
}
