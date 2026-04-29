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

  const items = isLoading ? Array.from({ length: 3 }, () => null) : steps

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      {items.map((step, i) => {
        const children = step?.children ?? []
        return (
          <Box
            key={step?.key ?? i}
            display="flex"
            flexDirection="column"
            rowGap="s"
            borderRadius="md"
            padding="l"
            backgroundColor="background-card"
            borderWidth={isDark ? 0 : 1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <ChecklistRow
              isLoading={isLoading}
              step={step ?? undefined}
              variant="parent"
            />
            {children.length > 0 && (
              <Box
                display="flex"
                flexDirection="column"
                rowGap="xs"
                paddingLeft="xs"
              >
                {children.map((child) => (
                  <ChecklistRow
                    isLoading={isLoading}
                    key={child.key}
                    step={child}
                    variant="child"
                  />
                ))}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
