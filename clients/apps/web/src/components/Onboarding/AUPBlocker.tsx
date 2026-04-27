'use client'

import { Box } from '@polar-sh/orbit/Box'

export function AUPBlocker({ categories }: { categories: string[] }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="m"
      borderRadius="md"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-warning"
      backgroundColor="background-warning"
      padding="l"
    >
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Not supported: {categories.join(', ')}
      </p>
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
        Polar is a Merchant of Record for digital products only. Physical goods,
        human services, and marketplaces are not permitted under our{' '}
        <a
          href="https://polar.sh/legal/acceptable-use-policy"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Acceptable Use Policy
        </a>
        .
      </p>
    </Box>
  )
}
