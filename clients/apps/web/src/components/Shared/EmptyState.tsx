import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ButtonProps } from '@polar-sh/orbit/ui/button'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actions?: ButtonProps[]
}

export const EmptyState = ({
  icon,
  title,
  description,
  actions,
}: EmptyStateProps) => {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="s"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="3xl"
    >
      <div className="dark:text-polar-500 text-5xl text-gray-500">{icon}</div>
      <Box flexDirection="column" alignItems="center" textAlign="center">
        <Text variant="heading-xxs" as="h3">
          {title}
        </Text>
        <Text color="muted">{description}</Text>
      </Box>
      {(actions?.length ?? 0) > 0 ? (
        <Box marginTop="l" columnGap="l">
          {actions?.map((action, index) => (
            <Button key={index} {...action} />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
