import React, { ElementType, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type Tone = 'foreground' | 'muted'

const tones: Record<Tone, string> = {
  foreground: 'text-brand-foreground',
  muted: 'text-brand-muted',
}

interface TextProps {
  as?: ElementType
  tone?: Tone
  className?: string
  children: ReactNode
}

// Shared horizontal layout container: centered, max width, responsive gutters.
export function BrandContainer({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: ElementType
  className?: string
  children: ReactNode
}) {
  return (
    <Tag
      className={twMerge(
        'mx-auto w-full max-w-[1600px] px-8 md:px-16',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

const DISPLAY = 'text-[clamp(3rem,10vw,11rem)] leading-[0.92]'
export function Display({
  as: Tag = 'h1',
  tone = 'foreground',
  className,
  children,
}: TextProps) {
  return (
    <Tag className={twMerge(DISPLAY, tones[tone], className)}>{children}</Tag>
  )
}

const HEADING = 'text-[clamp(2.75rem,7vw,7rem)] leading-[0.95] text-balance'
export function Heading({
  as: Tag = 'h2',
  tone = 'foreground',
  className,
  children,
}: TextProps) {
  return (
    <Tag className={twMerge(HEADING, tones[tone], className)}>{children}</Tag>
  )
}

const TRAIT = 'text-4xl md:text-7xl'
export function Trait({
  as: Tag = 'h3',
  tone = 'foreground',
  className,
  children,
}: TextProps) {
  return (
    <Tag className={twMerge(TRAIT, tones[tone], className)}>{children}</Tag>
  )
}

const SPECIMEN = 'text-7xl leading-[0.85]'
export function Specimen({
  as: Tag = 'span',
  tone = 'foreground',
  className,
  children,
}: TextProps) {
  return (
    <Tag className={twMerge(SPECIMEN, tones[tone], className)}>{children}</Tag>
  )
}

const LEAD = 'text-xl leading-relaxed text-pretty md:text-2xl max-w-2xl'
export function Lead({
  as: Tag = 'p',
  tone = 'muted',
  className,
  children,
}: TextProps) {
  return <Tag className={twMerge(LEAD, tones[tone], className)}>{children}</Tag>
}

const BODY = 'text-xl leading-relaxed'
export function Body({
  as: Tag = 'p',
  tone = 'muted',
  className,
  children,
}: TextProps) {
  return <Tag className={twMerge(BODY, tones[tone], className)}>{children}</Tag>
}

const LABEL = 'text-lg'
export function Label({
  as: Tag = 'span',
  tone = 'muted',
  className,
  children,
}: TextProps) {
  return (
    <Tag className={twMerge(LABEL, tones[tone], className)}>{children}</Tag>
  )
}

const MONO = 'font-mono text-xl'
export function Mono({
  as: Tag = 'span',
  tone = 'muted',
  className,
  children,
}: TextProps) {
  return <Tag className={twMerge(MONO, tones[tone], className)}>{children}</Tag>
}
