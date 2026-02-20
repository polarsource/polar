import { Headline } from '@/components/Orbit'
import type { ReactNode } from 'react'

// ─── Page header ─────────────────────────────────────────────────────────────

export function OrbitPageHeader({
  label,
  title,
  description,
}: {
  label?: string
  title: string
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      {label && <Headline as="span" text={label} />}
      <Headline as="h2" text={title} />
      {description && (
        <p className="dark:text-polar-400 text-base leading-relaxed text-neutral-600">
          {description}
        </p>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

export function OrbitSectionHeader({
  title,
  description,
}: {
  title: string
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <Headline as="h4" text={title} />
      <div className="dark:border-polar-800 border-t border-neutral-200" />
      {description && (
        <p className="dark:text-polar-400 text-sm text-neutral-600">
          {description}
        </p>
      )}
    </div>
  )
}
