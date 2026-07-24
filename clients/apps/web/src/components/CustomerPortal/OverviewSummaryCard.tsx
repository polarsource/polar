import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

interface OverviewSummaryCardProps {
  title: string
  meta?: ReactNode
  children: ReactNode
}

export const OverviewSummaryCard = ({
  title,
  meta,
  children,
}: OverviewSummaryCardProps) => {
  return (
    <Box
      flexDirection="column"
      rowGap="l"
      borderRadius="xl"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="2xl"
    >
      <Box
        flexDirection={{ base: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent={{ sm: 'between' }}
        rowGap="xs"
      >
        <Text variant="heading-xxs" as="h4">
          {title}
        </Text>
        {meta && <Text color="muted">{meta}</Text>}
      </Box>

      <Box flexDirection="column" rowGap="s">
        {children}
      </Box>
    </Box>
  )
}
