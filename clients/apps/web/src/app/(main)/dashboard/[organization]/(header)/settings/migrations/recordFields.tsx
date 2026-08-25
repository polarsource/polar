import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

// The detail panels read as one scale: every label and every value is caption
// sized, and hierarchy comes from color and weight instead. Values used to be
// body sized against caption labels, which made each row look misaligned.

export function FieldSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Text variant="label">{title}</Text>
      <Box flexDirection="column" rowGap="s">
        {children}
      </Box>
    </Box>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Box alignItems="baseline" columnGap="l" justifyContent="between">
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Box minWidth={0} justifyContent="end">
        {children}
      </Box>
    </Box>
  )
}

export function FieldValue({
  children,
  muted = false,
  monospace = false,
}: {
  children: ReactNode
  muted?: boolean
  monospace?: boolean
}) {
  return (
    <Text
      variant="caption"
      color={muted ? 'muted' : 'default'}
      monospace={monospace}
      tabularNums
      truncate
    >
      {children}
    </Text>
  )
}
