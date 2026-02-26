'use client'

import { motion } from 'framer-motion'
import React, { useRef } from 'react'
import { twMerge } from 'tailwind-merge'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span'

const defaultSizes: Record<HeadingTag, string> = {
  h1: 'text-5xl md:text-7xl font-light tracking-tight leading-tighter!',
  h2: 'text-4xl md:text-5xl tracking-tight leading-tight!',
  h3: 'text-3xl md:text-5xl tracking-tight leading-tight!',
  h4: 'text-2xl md:text-3xl tracking-tight leading-tight!',
  h5: 'text-xl md:text-2xl tracking-tight leading-tight!',
  h6: 'text-lg md:text-xl tracking-tight leading-tight!',
  span: 'font-medium leading-tight!',
}

const motionTags: Record<HeadingTag, React.ElementType> = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  span: motion.span,
}

type HeadlineProps<T extends HeadingTag = 'h2'> = {
  as?: T
  text: string | string[]
  size?: string
  animate?: boolean
} & Omit<React.ComponentPropsWithoutRef<T>, 'size' | 'children'>

export function Headline<T extends HeadingTag>({
  as,
  text,
  size,
  className,
  style,
  ...props
}: HeadlineProps<T>) {
  const Tag = (as ?? 'h2') as HeadingTag
  const sizeClass = size ?? defaultSizes[Tag]
  const lines = Array.isArray(text) ? text : [text]

  const ref = useRef<HTMLElement>(null)

  const sharedClassName = twMerge(
    'text-black dark:text-white font-display',
    sizeClass,
    className,
  )
  const sharedStyle = {
    fontFeatureSettings: "'ss07' 1, 'ss08' 1, 'zero' 1, 'liga' 0",
    ...style,
  }

  return (
    <Tag
      ref={ref as React.Ref<HTMLHeadingElement>}
      className={sharedClassName}
      style={sharedStyle}
      {...(props as React.ComponentPropsWithoutRef<HeadingTag>)}
    >
      {lines.length === 1
        ? lines[0]
        : lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
    </Tag>
  )
}
