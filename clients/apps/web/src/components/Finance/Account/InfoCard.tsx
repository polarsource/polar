'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'

interface Props {
  children: React.ReactNode
}

export const InfoCard = ({ children }: Props) => {
  return (
    <Box
      borderRadius="l"
      backgroundColor="background-card"
      padding="l"
      textAlign="center"
    >
      <Text variant="caption" color="muted">
        {children}
      </Text>
    </Box>
  )
}
