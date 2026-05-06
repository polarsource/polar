import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

// ── Component ─────────────────────────────────────────────────────────────────
export const Pricing = () => {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: 'repeat(1, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
      }}
      gap="l"
    >
      {/* Left — text */}
      <Box
        backgroundColor="background-secondary"
        gridColumn={{
          base: 'span 1 / span 1',
          md: 'span 2 / span 2',
        }}
        display="flex"
        flexDirection="column"
        rowGap="2xl"
        padding="3xl"
        flex={{
          md: 1,
        }}
      >
        <h2 className="font-display text-3xl leading-tight! md:text-5xl">
          Eveything you need
          <br />
          for a flat fee
        </h2>
        <p className="dark:text-polar-500 max-w-xl text-lg leading-relaxed text-pretty text-gray-500">
          One flat rate covers payment processing, global tax compliance, and
          reliable support. No monthly fees, no setup costs.
        </p>

        <Box display="flex" columnGap="m">
          <Link href="/resources/pricing" target="_blank">
            <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-gray-900 dark:bg-white dark:text-black">
              Pricing Guide
            </Button>
          </Link>
        </Box>
      </Box>
      {/* Right — visual fee breakdown */}
      <Box
        backgroundColor="background-secondary"
        display="flex"
        flexDirection="column"
        rowGap="l"
        flex={{
          md: 1,
        }}
      >
        {/* Fee display */}
        <Box display="flex" flexDirection="column" rowGap="2xl" padding="3xl">
          <Box display="flex" flexDirection="column" rowGap="l">
            <Box display="flex" alignItems="baseline" columnGap="m">
              <Text variant="heading-l">4%</Text>
              <Text variant="heading-s">+ 40¢</Text>
            </Box>
            <Text variant="mono">per transaction</Text>
          </Box>
          <Box as="ul" display="flex" flexDirection="column" rowGap="s">
            {[
              'Global tax & VAT compliance included',
              'Fraud protection & chargebacks handled',
              'Volume discounts for high-growth teams',
              'No monthly or setup fees',
            ].map((item) => (
              <Box as="li" display="flex" columnGap="l" key={item}>
                <CheckOutlined
                  className="text-black dark:text-white"
                  fontSize="small"
                />
                <Box as="span">{item}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
