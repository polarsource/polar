import { Box, Headline, Text } from '@/components/Orbit'
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
    <Box display="flex" flexDirection="column" gap={3}>
      {label && <Headline as="span" text={label} />}
      <Headline as="h2" text={title} />
      {description && (
        <Text variant="subtle" fontSize="base" leading="relaxed">
          {description}
        </Text>
      )}
    </Box>
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
    <Box display="flex" flexDirection="column" className="gap-3">
      <Headline as="h4" text={title} />
      <Box className="dark:border-polar-800 border-t border-neutral-200" />
      {description && (
        <Text variant="subtle" fontSize="sm">
          {description}
        </Text>
      )}
    </Box>
  )
}
