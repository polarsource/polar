import React from 'react'
import { twMerge } from 'tailwind-merge'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span'

const defaultSizes: Record<HeadingTag, string> = {
  h1: 'text-5xl md:text-8xl font-light tracking-tighter leading-tighter!',
  h2: 'text-4xl md:text-5xl tracking-tighter leading-tight!',
  h3: 'text-3xl md:text-5xl tracking-tighter leading-tight!',
  h4: 'text-2xl md:text-3xl tracking-tighter leading-tight!',
  h5: 'text-xl md:text-2xl tracking-tighter leading-tight!',
  h6: 'text-lg md:text-xl tracking-tighter leading-tight!',
  span: 'font-medium leading-tight!',
}

type HeadlineProps<T extends HeadingTag = 'h2'> = {
  as?: T
  text: string | string[]
  size?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'size' | 'children'>

export function Headline<T extends HeadingTag = 'h2'>({
  as,
  text,
  size,
  className,
  style,
  ...props
}: HeadlineProps<T>) {
  const Tag = (as ?? 'h2') as HeadingTag
  const sizeClass = size ?? defaultSizes[Tag]

  const content = Array.isArray(text)
    ? text.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))
    : text

  return (
    <Tag
      className={twMerge('text-black dark:text-white', sizeClass, className)}
      style={{
        fontFeatureSettings: "'ss07' 1, 'ss08' 1, 'zero' 1, 'liga' 0",
        ...style,
      }}
      {...(props as React.ComponentPropsWithoutRef<HeadingTag>)}
    >
      {content}
    </Tag>
  )
}
