import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

export function VoidLoading(): ReactNode {
  return <Box height={128} borderRadius="m" backgroundColor="background-card" />
}

export function VoidError({ message }: { message: string }): ReactNode {
  return (
    <Box
      borderRadius="m"
      backgroundColor="background-warning"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-warning"
      padding="l"
    >
      <Text>{message}</Text>
    </Box>
  )
}
