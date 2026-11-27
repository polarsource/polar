import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

export const UpdateSubscriptionSection = ({
  title,
  description,
  divider = false,
  children,
}: {
  // Left out where the fields' own labels already say what the section is.
  title?: string
  description?: string
  divider?: boolean
  children: ReactNode
}) => (
  <Box
    as="section"
    flexDirection="column"
    rowGap="l"
    borderTopWidth={divider ? 1 : undefined}
    borderStyle={divider ? 'solid' : undefined}
    borderColor={divider ? 'border-primary' : undefined}
    paddingTop={divider ? '2xl' : undefined}
  >
    {title && (
      <Box flexDirection="column" rowGap="xs">
        <Text variant="title" as="h3">
          {title}
        </Text>
        {description && (
          <Text variant="caption" color="muted">
            {description}
          </Text>
        )}
      </Box>
    )}
    {children}
  </Box>
)
