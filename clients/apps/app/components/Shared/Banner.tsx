import { Box } from '@/components/Shared/Box'
import { PropsWithChildren } from 'react'
import { Text } from './Text'

export interface BannerProps extends PropsWithChildren {
  title: string
  description: string
  cta?: boolean
}

export const Banner = ({ title, description, children }: BannerProps) => {
  return (
    <Box
      flexDirection="column"
      padding="spacing-16"
      borderRadius="border-radius-16"
      gap="spacing-16"
      backgroundColor="card"
    >
      <Box flex={1} gap="spacing-6">
        <Text variant="bodySmall">{title}</Text>
        <Text variant="bodySmall" color="subtext">
          {description}
        </Text>
      </Box>
      {children}
    </Box>
  )
}
