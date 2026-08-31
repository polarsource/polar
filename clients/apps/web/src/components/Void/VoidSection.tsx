'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'

interface VoidSectionProps {
  label: string
  meta?: string
  anchor?: string
  flush?: boolean
}

export const VoidSection = ({
  label,
  meta,
  anchor,
  flush,
  children,
}: PropsWithChildren<VoidSectionProps>) => (
  <Box
    as="section"
    id={anchor}
    flexDirection="column"
    borderTopWidth={flush ? 0 : 1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingTop={flush ? 'none' : '2xl'}
    paddingBottom="5xl"
    rowGap="4xl"
  >
    <Box justifyContent="between" alignItems="baseline">
      <Text variant="heading-l">{label}</Text>
      {meta ? (
        <Text variant="heading-xxs" color="muted">
          {meta}
        </Text>
      ) : null}
    </Box>
    {children}
  </Box>
)
