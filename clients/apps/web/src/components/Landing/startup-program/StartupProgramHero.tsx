'use client'

import ArrowForward from '@mui/icons-material/ArrowForward'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

const STATS = [
  { value: 'Free', label: 'Scale tier' },

  { value: '12 months', label: 'Program length' },
]

const SCALE_FEATURES = ['Slack Channel', 'Prioritized Ticket support']

export const StartupProgramHero = () => {
  return (
    <Box flexDirection="column" rowGap="3xl">
      <Box flexDirection="column" rowGap="2xl">
        <Text as="h3" variant="heading-l" wrap="pretty">
          Polar for Startups
        </Text>
        <Text variant="heading-xs" wrap="balance">
          Handle usage-based billing, global tax compliance and real-time cost
          analytics in one platform, so you can scale your business without the
          operational drag.
        </Text>
      </Box>

      <Box flexDirection="row">
        {STATS.map((s, i) => (
          <Box
            key={s.label}
            flexDirection="column"
            rowGap="xs"
            paddingHorizontal="xl"
            paddingLeft={i === 0 ? 'none' : 'xl'}
            borderLeftWidth={i === 0 ? 0 : 1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="body" color="muted">
              {s.label}
            </Text>
            <Text variant="body">{s.value}</Text>
          </Box>
        ))}
      </Box>

      <Box
        flexDirection="column"
        rowGap="xl"
        padding={{
          base: 'xl',
          md: '3xl',
        }}
        backgroundColor="background-secondary"
      >
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-s">Scale</Text>
          <Text variant="body" color="muted">
            For fast growing businesses
          </Text>
        </Box>

        <Box flexDirection="column" rowGap="s">
          <Box flexDirection="row" alignItems="baseline" columnGap="m">
            <Text variant="heading-s">Free</Text>
            <Text variant="body" color="muted">
              for 1 year
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" rowGap="xs">
          <Text variant="body" color="muted">
            Transaction Fee
          </Text>
          <Text variant="body">3.40% + $0.30</Text>
        </Box>

        <Box flexDirection="column" rowGap="s">
          <Text variant="body" color="muted">
            Features
          </Text>
          {SCALE_FEATURES.map((f) => (
            <Box key={f} flexDirection="row" alignItems="center" columnGap="s">
              <CheckOutlined fontSize="inherit" />
              <Text variant="body">{f}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Link href="/resources/pricing">
        <Box
          display="inline-flex"
          flexDirection="row"
          alignItems="center"
          columnGap="xs"
          color={{ base: 'text-secondary', hover: 'text-primary' }}
        >
          <Text variant="body" color="inherit">
            More about our pricing
          </Text>
          <ArrowForward fontSize="inherit" />
        </Box>
      </Link>
    </Box>
  )
}
