import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
  PosterMono,
  PosterRule,
} from '../PosterFrame'

const LINES: [string, string][] = [
  ['tokens.out × 1,204,318', '$2.41'],
  ['Seats × 3', '$36.00'],
  ['Credits applied', '-$10.00'],
  ['VAT 25%', '$7.10'],
]

/** 22. The invoice, assembled from everything that came before. */
export const InvoicePoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <PosterHeader>INVOICE 0042</PosterHeader>
        <PosterRule />
        <Box flexDirection="column" rowGap="s">
          {LINES.map(([label, amount]) => (
            <Box key={label} justifyContent="between" columnGap="l">
              <PosterMono dim>{label}</PosterMono>
              <PosterMono>{amount}</PosterMono>
            </Box>
          ))}
        </Box>
        <PosterRule />
        <Box justifyContent="between" alignItems="baseline">
          <PosterMono>TOTAL</PosterMono>
          <Text variant="heading-xs" as="span" color="inherit" tabularNums>
            $35.51
          </Text>
        </Box>
      </Box>
      <PosterHeadline primary="One invoice," secondary="nothing typed in" />
    </PosterBody>
  </PosterFrame>
)

const RATES: [string, string][] = [
  ['SE', '25%'],
  ['DE', '19%'],
  ['GB', '20%'],
  ['JP', '10%'],
  ['US-CA', '7.25%'],
  ['AU', '10%'],
]

/** 23. Tax, wherever the customer happens to be. */
export const TaxPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="s">
        <PosterHeader>VAT BY REGION</PosterHeader>
        {RATES.map(([region, rate], index) => (
          <Box
            key={region}
            flexDirection="column"
            rowGap="s"
            paddingTop={index > 0 ? 's' : 'none'}
          >
            {index > 0 ? <PosterRule /> : null}
            <Box justifyContent="between">
              <PosterMono>{region}</PosterMono>
              <PosterMono dim>{rate}</PosterMono>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline primary="Tax handled," secondary="wherever they are" />
    </PosterBody>
  </PosterFrame>
)

const RESPONSIBILITIES: [string, string][] = [
  ['Sales tax and VAT', 'POLAR'],
  ['Fraud screening', 'POLAR'],
  ['Chargebacks', 'POLAR'],
  ['Compliance', 'POLAR'],
  ['Your product', 'YOU'],
]

/** 24. Merchant of record: who carries what. */
export const SellerPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <Box flexDirection="column">
        <Box paddingBottom="s">
          <PosterHeader>HANDLED BY</PosterHeader>
        </Box>
        {RESPONSIBILITIES.map(([item, owner]) => (
          <Box key={item} flexDirection="column" rowGap="s" paddingTop="s">
            <PosterRule />
            <Box justifyContent="between" alignItems="baseline">
              <Text variant="heading-xxs" as="span" color="inherit">
                {item}
              </Text>
              <PosterMono>{owner}</PosterMono>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline
        primary="Merchant of record"
        secondary="liability included"
      />
    </PosterBody>
  </PosterFrame>
)
