'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'

interface VoidSectionProps {
  label: string
  meta?: string
  anchor?: string
}

export const VoidSection = ({
  label,
  meta,
  anchor,
  children,
}: PropsWithChildren<VoidSectionProps>) => (
  <Box
    as="section"
    id={anchor}
    flexDirection="column"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingTop="2xl"
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
