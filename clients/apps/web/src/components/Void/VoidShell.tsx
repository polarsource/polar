'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

export const VoidDetailShell = ({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: ReactNode
}) => (
  <MasterDetailLayoutContent
    header={
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h1">
          {title}
        </Text>
        {caption ? <Text color="muted">{caption}</Text> : null}
      </Box>
    }
  >
    {children}
  </MasterDetailLayoutContent>
)

/**
 * A section title with an optional caption beside it, both at the same size so
 * the caption reads as part of the headline rather than a footnote.
 */
export const VoidSectionHeading = ({
  title,
  caption,
  as = 'h3',
  variant = 'heading-xxs',
  spread = false,
}: {
  title: string
  caption?: string
  as?: 'h2' | 'h3' | 'h4'
  variant?: 'heading-xs' | 'heading-xxs' | 'body'
  spread?: boolean
}) => (
  <Box
    alignItems="baseline"
    justifyContent={spread ? 'between' : 'start'}
    columnGap="m"
  >
    <Text variant={variant} as={as}>
      {title}
    </Text>
    {caption ? (
      <Text variant={variant} color="muted">
        {caption}
      </Text>
    ) : null}
  </Box>
)

export const VoidErrorBox = ({ message }: { message: string }) => (
  <Box
    borderRadius="m"
    backgroundColor="background-warning"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-warning"
    padding="l"
  >
    <Text>{message}</Text>
  </Box>
)
