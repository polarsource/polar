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
