import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'

const invoice = [
  { label: 'Tokens', value: '1,284,302' },
  { label: 'Rate', value: '$0.0032' },
  { label: 'Total', value: '$4,109.77' },
]

export function TypographySection() {
  return (
    <Chapter
      id={brandSections[2].id}
      index={brandSections[2].index}
      name={brandSections[2].label}
      title="PP Neue Montreal"
      subtitle="Geist Mono for code and data"
      description="PP Neue Montreal is the single typeface of the identity, chosen for its clarity and structured geometry. Geist Mono carries technical detail."
    >
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
        <Box
          flexDirection="column"
          rowGap="2xl"
          padding={{ base: 'xl', md: '3xl' }}
          backgroundColor="background-secondary"
        >
          <Text variant="caption" color="muted">
            PP Neue Montreal
          </Text>
          <Text variant="heading-l" as="span">
            Usage billing
          </Text>
          <Text variant="heading-xs" color="muted">
            Meter every token. Invoice every cent.
          </Text>
        </Box>
        <Box
          flexDirection="column"
          rowGap="2xl"
          padding={{ base: 'xl', md: '3xl' }}
          backgroundColor="background-secondary"
        >
          <Text variant="caption" color="muted">
            Geist Mono
          </Text>
          <Text variant="heading-l" as="span" monospace>
            Usage
          </Text>
          <Box flexDirection="column" rowGap="s">
            {invoice.map((row, index) => (
              <Box
                key={row.label}
                justifyContent="between"
                alignItems="baseline"
                columnGap="xl"
                paddingTop={index === invoice.length - 1 ? 's' : 'none'}
                borderTopWidth={index === invoice.length - 1 ? 1 : 0}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Text variant="heading-xxs" monospace>
                  {row.label}
                </Text>
                <Text variant="heading-xxs" monospace tabularNums>
                  {row.value}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Grid>
    </Chapter>
  )
}
