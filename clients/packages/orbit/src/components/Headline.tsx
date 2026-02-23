'use client'

import { motion, useInView } from 'framer-motion'
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

const lineVariants = {
  hidden: { y: '130%' },
  visible: {
    y: 0,
    transition: {
      duration: 1.7,
      ease: [0.7, 0, 0.3, 1] as [number, number, number, number],
    },
  },
}

function containerVariants(lineCount: number) {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: 0.2 / lineCount } },
  }
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
  animate,
  className,
  style,
  ...props
}: HeadlineProps<T>) {
  const Tag = (as ?? 'h2') as HeadingTag
  const sizeClass = size ?? defaultSizes[Tag]
  const lines = Array.isArray(text) ? text : [text]

  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0 })

  const sharedClassName = twMerge(
    'text-black dark:text-white font-display',
    sizeClass,
    className,
  )
  const sharedStyle = {
    fontFeatureSettings: "'ss07' 1, 'ss08' 1, 'zero' 1, 'liga' 0",
    ...style,
  }

  if (animate) {
    const MotionTag = motionTags[Tag]
    return (
      <MotionTag
        ref={ref}
        className={sharedClassName}
        style={sharedStyle}
        variants={containerVariants(lines.length)}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        {...(props as object)}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              overflow: 'hidden',
              paddingBottom: '0.25em',
              marginBottom: '-0.25em',
            }}
          >
            <motion.span variants={lineVariants} style={{ display: 'block' }}>
              {line}
            </motion.span>
          </span>
        ))}
      </MotionTag>
    )
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
