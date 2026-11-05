import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface StatisticCardProps {
  title: string
  className?: string
  size?: 'sm' | 'lg'
}

// A ruled column of type rather than a filled card: hairline on top, a small
// label, then the figure.
export const StatisticCard = ({
  title,
  children,
  className,
  size = 'sm',
}: PropsWithChildren<StatisticCardProps>) => (
  <div className={twMerge('flex min-w-0 flex-1', className)}>
    <Box
      flex={1}
      flexDirection="column"
      rowGap={size === 'lg' ? 's' : 'xs'}
      minWidth={0}
      paddingTop="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text color="muted" truncate>
        {title}
      </Text>
      <Text
        as="div"
        variant={size === 'lg' ? 'heading-s' : 'heading-xxs'}
        truncate
      >
        {children}
      </Text>
    </Box>
  </div>
)
