'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AlertCircleIcon, AlertTriangleIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

type Tone = 'danger' | 'warning'

interface PathCardBannerProps {
  tone: Tone
  title: string
  description: ReactNode
}

const ICONS: Record<Tone, ComponentType<{ className?: string }>> = {
  danger: AlertCircleIcon,
  warning: AlertTriangleIcon,
}

export const PathCardBanner = ({
  tone,
  title,
  description,
}: PathCardBannerProps) => {
  const Icon = ICONS[tone]
  const iconColor = tone === 'danger' ? 'text-danger' : 'text-warning'

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="xs"
      paddingHorizontal="l"
      paddingBottom="l"
    >
      <Box display="flex" alignItems="center" columnGap="xs">
        <Box color={iconColor} display="inline-flex">
          <Icon className="h-3.5 w-3.5" />
        </Box>
        <Text variant="label" color={tone}>
          {title}
        </Text>
      </Box>
      <Text variant="caption" color="muted">
        {description}
      </Text>
    </Box>
  )
}
