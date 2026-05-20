import { Box } from '@polar-sh/orbit/Box'
import { BrickWallShieldIcon } from 'lucide-react'

export interface AccessRestrictedProps {
  message: string
}

export default function AccessRestricted({ message }: AccessRestrictedProps) {
  return (
    <Box
      backgroundColor="background-card"
      borderRadius="l"
      padding="3xl"
      display="flex"
      flexDirection="column"
      alignItems="center"
      rowGap="m"
    >
      <BrickWallShieldIcon
        className="dark:text-polar-500 size-8 shrink-0 text-gray-500"
        strokeWidth={1.5}
      />
      <h2 className="text-xl font-medium">Restricted access</h2>
      <p className="dark:text-polar-500 max-w-sm text-center text-balance text-gray-500">
        {message}
      </p>
    </Box>
  )
}
