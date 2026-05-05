import { Stack, Text } from '@polar-sh/orbit'
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
      {label && (
        <Text as="span" variant="heading-xxs">
          {label}
        </Text>
      )}
      <Text as="h2" variant="heading-l">
        {title}
      </Text>
      {description && <Text color="muted">{description}</Text>}
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
      <Text as="h4" variant="heading-s">
        {title}
      </Text>
      <div className="dark:border-polar-800 border-t border-neutral-200" />
      {description && <Text color="muted">{description}</Text>}
    </Stack>
  )
}
