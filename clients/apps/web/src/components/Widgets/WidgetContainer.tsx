import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface WidgetContainerProps {
  title: string
  headline?: ReactNode
  action?: ReactNode
  className?: string
}

export const WidgetContainer = ({
  title,
  headline,
  action,
  className,
  children,
}: PropsWithChildren<WidgetContainerProps>) => {
  return (
    <div
      className={twMerge('flex h-88 flex-col gap-6 overflow-hidden', className)}
    >
      <Box
        flexShrink={0}
        alignItems="start"
        justifyContent="between"
        columnGap="m"
        paddingHorizontal="xl"
        paddingTop="xl"
      >
        <Box flexDirection="column" rowGap="s" minWidth={0}>
          <Text>{title}</Text>
          {headline}
        </Box>
        {action}
      </Box>
      <div className="flex flex-1 flex-col overflow-y-auto px-6">
        {children}
      </div>
    </div>
  )
}
