import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { type ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
}) {
  return (
    <Box
      as="header"
      flexDirection="column"
      rowGap="m"
      paddingBottom="xl"
      marginBottom="2xl"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {eyebrow && (
        <Text variant="label" color="muted">
          {eyebrow}
        </Text>
      )}
      <Text variant="heading-s" as="h1">
        {title}
      </Text>
      {description && (
        <Box maxWidth={620}>
          <Text variant="body" color="muted">
            {description}
          </Text>
        </Box>
      )}
    </Box>
  )
}
