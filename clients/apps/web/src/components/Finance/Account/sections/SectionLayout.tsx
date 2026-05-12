'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

interface Props {
  description?: ReactNode
  children: ReactNode
  footerStart?: ReactNode
  footerEnd?: ReactNode
}

export const SectionLayout = ({
  description,
  children,
  footerStart,
  footerEnd,
}: Props) => {
  const hasFooter = !!footerStart || !!footerEnd

  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      {description && (
        <Text variant="default" color="muted">
          {description}
        </Text>
      )}
      {children}
      {hasFooter && (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="between"
          columnGap="s"
        >
          <Box>{footerStart}</Box>
          {footerEnd}
        </Box>
      )}
    </Box>
  )
}
