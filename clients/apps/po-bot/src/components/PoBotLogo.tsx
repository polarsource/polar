import { Text } from '@polar-sh/orbit/Text'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

/** Mark plus wordmark, sized like the dashboard's logotype. */
export const PoBotLogo = ({ size = 28 }: { size?: number }) => (
  <Link href="/" style={{ display: 'contents' }}>
    <Box alignItems="center" columnGap="s" color="text-primary">
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="24" height="24" rx="12" fill="currentColor" />
        <circle cx="10" cy="14" r="2.4" fill="var(--background)" />
        <circle cx="18" cy="14" r="2.4" fill="var(--background)" />
      </svg>
      <Text variant="heading-xxs" as="span">
        Po Bot
      </Text>
    </Box>
  </Link>
)
