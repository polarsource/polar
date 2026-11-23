import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

export function CopyTaskRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <Box
      as="li"
      display={{ base: 'flex', md: 'grid' }}
      flexDirection="column"
      gridTemplateColumns={{
        base: '1fr',
        md: 'minmax(0, 1fr) 320px',
      }}
      alignItems={{ base: 'stretch', md: 'center' }}
      columnGap="xl"
      rowGap="m"
      paddingVertical="l"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box flexDirection="column" rowGap="xs">
        <Text variant="caption">{title}</Text>
        {description && (
          <Text variant="caption" color="muted">
            {description}
          </Text>
        )}
      </Box>
      <Box
        width="100%"
        justifyContent={{ base: 'start', md: 'end' }}
        flexShrink={0}
      >
        {children}
      </Box>
    </Box>
  )
}
