'use client'

import { Alert } from '@polar-sh/orbit/Alert'
import { Box } from '@polar-sh/orbit/Box'

export default function Error({ error }: { error: Error }) {
  const unauthorized =
    error.message.includes('401') || error.message.includes('void login')
  return (
    <Box
      as="main"
      flexDirection="column"
      width="100%"
      maxWidth={720}
      marginHorizontal="auto"
      paddingHorizontal="xl"
      paddingVertical="4xl"
    >
      <Alert
        variant="warning"
        title={unauthorized ? 'Void is unauthorized' : 'Something went wrong'}
        description={
          unauthorized
            ? 'Run `pnpm void login` and pick the po-bot organization.'
            : error.message
        }
      />
    </Box>
  )
}
