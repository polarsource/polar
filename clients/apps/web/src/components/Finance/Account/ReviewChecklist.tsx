'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useTheme } from 'next-themes'
import { ChecklistRow } from './ChecklistRow'

interface Props {
  steps: schemas['OrganizationReviewCheck'][]
  isLoading: boolean
}

export const ReviewChecklist = ({ steps, isLoading }: Props) => {
  const { resolvedTheme: theme } = useTheme()
  const isDark = theme === 'dark'

  const items = isLoading ? Array.from({ length: 5 }, () => null) : steps

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      {items.map((step, i) => (
        <Box
          key={step?.key ?? i}
          borderRadius="m"
          padding="l"
          backgroundColor="background-card"
          borderWidth={isDark ? 0 : 1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <ChecklistRow isLoading={isLoading} step={step ?? undefined} />
        </Box>
      ))}
    </Box>
  )
}
