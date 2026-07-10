import { CountEntity, EntityCount } from '@/hooks/queries/merchantMigrations'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { entityLabelPlural } from './reviewRows'

interface Props {
  counts: Record<CountEntity, EntityCount>
  importCount: number
  onImport: () => void
  importing: boolean
}

const STAT_ORDER: CountEntity[] = ['products', 'customers', 'subscriptions']
const numberFormat = new Intl.NumberFormat('en-US')

export function ReviewSummary({
  counts,
  importCount,
  onImport,
  importing,
}: Props) {
  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ md: 'center' }}
      justifyContent="between"
      columnGap="2xl"
      rowGap="xl"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      backgroundColor="background-card"
      padding="xl"
    >
      <Box flexDirection="column" rowGap="l" minWidth={0}>
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h2">
            Import your Stripe catalog
          </Text>
          <Text color="muted">
            Everything imports in one step. Subscriptions arrive paused; nothing
            is billed until cutover.
          </Text>
        </Box>
        <Box columnGap="2xl" rowGap="l" flexWrap="wrap">
          {STAT_ORDER.map((entity) => (
            <Box key={entity} flexDirection="column" rowGap="xs">
              <Text variant="heading-m" as="span" tabularNums>
                {numberFormat.format(counts[entity].importable)}
              </Text>
              <Text variant="caption" color="muted">
                {entityLabelPlural(entity)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="s" alignItems={{ md: 'end' }}>
        <Button
          size="lg"
          onClick={onImport}
          disabled={importing || importCount <= 0}
        >
          {importing
            ? 'Importing…'
            : `Import ${numberFormat.format(importCount)} records`}
        </Button>
      </Box>
    </Box>
  )
}
