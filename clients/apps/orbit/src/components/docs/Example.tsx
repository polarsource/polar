import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { type ReactNode } from 'react'
import { CodeBlock } from './CodeBlock'

export function Example({
  title,
  description,
  code,
  align = 'center',
  children,
}: {
  title?: string
  description?: ReactNode
  code?: string
  /** Horizontal alignment of the preview content. */
  align?: 'start' | 'center' | 'stretch'
  children: ReactNode
}) {
  return (
    <Box flexDirection="column" rowGap="m">
      {(title || description) && (
        <Box flexDirection="column" rowGap="xs">
          {title && (
            <Text variant="heading-xxs" as="h3">
              {title}
            </Text>
          )}
          {description && (
            <Text variant="default" color="muted">
              {description}
            </Text>
          )}
        </Box>
      )}
      <Box
        flexDirection="column"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        overflow="hidden"
      >
        <Box
          flexDirection="column"
          alignItems={align}
          justifyContent="center"
          rowGap="l"
          padding="2xl"
          minHeight={120}
        >
          {children}
        </Box>
        {code && <CodeBlock code={code} />}
      </Box>
    </Box>
  )
}
