import { Headline, Stack, Text } from '@polar-sh/orbit'
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
    <Stack vertical gap={3}>
      {label && <Headline as="span" text={label} />}
      <Headline as="h2" text={title} />
      {description && (
        <Text variant="subtle">
          {description}
        </Text>
      )}
    </Stack>
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
    <Stack vertical gap={2}>
      <Headline as="h4" text={title} />
      <div className="dark:border-polar-800 border-t border-neutral-200" />
      {description && (
        <Text variant="subtle">
          {description}
        </Text>
      )}
    </Stack>
  )
}
