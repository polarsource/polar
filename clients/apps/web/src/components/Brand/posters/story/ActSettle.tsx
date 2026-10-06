import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
  PosterRule,
} from '../PosterFrame'

const SUMMARY: [string, string][] = [
  ['ORDERS', '14'],
  ['REFUNDS', '1'],
  ['DISPUTES', '0'],
  ['FEES', '3.40% + 30¢'],
]

/** 25. The payout, with every fee on the sheet. */
export const PayoutPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <Box justifyContent="between">
          <PosterMono>PAYOUT 0193</PosterMono>
          <PosterMono dim>USD</PosterMono>
        </Box>
        <Text variant="heading-m" as="p" color="inherit" tabularNums>
          2,418.20
        </Text>
        <Box flexDirection="column" rowGap="s">
          {SUMMARY.map(([label, value]) => (
            <Box key={label} justifyContent="between">
              <PosterMono dim>{label}</PosterMono>
              <PosterMono>{value}</PosterMono>
            </Box>
          ))}
        </Box>
      </Box>
      <PosterHeadline primary="Paid out" secondary="down to the last fee" />
    </PosterBody>
  </PosterFrame>
)

const SETTLEMENT: { label: string; amount: string; endpoint?: boolean }[] = [
  { label: 'CUSTOMER PAYS', amount: '$35.51', endpoint: true },
  { label: 'VAT REMITTED', amount: '-$7.10' },
  { label: 'POLAR FEE 3.40% + 30¢', amount: '-$1.51' },
  { label: 'YOU RECEIVE', amount: '$26.90', endpoint: true },
]

const Marker = ({ filled }: { filled?: boolean }) => (
  <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
    <circle
      cx={5}
      cy={5}
      r={4}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
    />
  </svg>
)

/** 26. One order, settled: what the customer paid and what reaches you. */
export const SettlementPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column">
        <Box justifyContent="between" paddingBottom="s">
          <PosterMono>SETTLEMENT</PosterMono>
          <PosterMono dim>ORDER 0042</PosterMono>
        </Box>
        {SETTLEMENT.map(({ label, amount, endpoint }) => (
          <Box key={label} flexDirection="column" rowGap="s" paddingTop="s">
            <PosterRule />
            <Box alignItems="center" columnGap="m">
              <Marker filled={endpoint} />
              <Box flex={1} justifyContent="between" columnGap="l">
                {endpoint ? (
                  <PosterMono>{label}</PosterMono>
                ) : (
                  <PosterMono dim>{label}</PosterMono>
                )}
                {endpoint ? (
                  <PosterMono>{amount}</PosterMono>
                ) : (
                  <PosterMono dim>{amount}</PosterMono>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline
        primary="The customer pays Polar"
        secondary="and Polar pays you"
      />
    </PosterBody>
  </PosterFrame>
)

/** 27. Thousands of transactions, booked as one invoice from Polar. */
export const BalancePoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <Box justifyContent="between">
          <PosterMono>YOUR BOOKS</PosterMono>
          <PosterMono dim>OCTOBER</PosterMono>
        </Box>
        <Box flexDirection="column">
          <Text variant="heading-m" as="p" color="inherit" tabularNums>
            <Box as="span" opacity={0.5}>
              4,812
            </Box>
          </Text>
          <PosterMono dim>ORDERS, REFUNDS, TAX, DISPUTES</PosterMono>
        </Box>
        <PosterRule />
        <Box flexDirection="column">
          <Text variant="heading-m" as="p" color="inherit" tabularNums>
            1
          </Text>
          <PosterMono dim>INVOICE, FROM POLAR</PosterMono>
        </Box>
      </Box>
      <PosterHeadline
        primary="Thousands of transactions"
        secondary="one invoice to book"
      />
    </PosterBody>
  </PosterFrame>
)
