import { schemas } from '@polar-sh/client'
import { Checkbox, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { benefitDetail } from './benefitCopy'

type Benefit = schemas['MerchantMigrationBenefit']

export function BenefitSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Box as="section" flexDirection="column" rowGap="s">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="label" as="h4">
          {title}
        </Text>
        {description && (
          <Text variant="caption" color="muted">
            {description}
          </Text>
        )}
      </Box>
      <Box
        as="ul"
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {children}
      </Box>
    </Box>
  )
}

export function BenefitRow({
  benefit,
  selected,
  onToggle,
}: {
  benefit: Benefit
  selected?: boolean
  onToggle?: () => void
}) {
  const where = benefit.benefit_id
    ? 'Created'
    : benefit.products.map((product) => product.name).join(', ')
  return (
    <Box
      as="li"
      display="flex"
      columnGap="m"
      alignItems="start"
      paddingVertical="m"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {onToggle && (
        <Box paddingTop="xs">
          <Checkbox
            checked={selected}
            // A created benefit stays: unticking it couldn't remove it.
            disabled={!!benefit.benefit_id}
            aria-label={`Create ${benefit.description}`}
            onCheckedChange={onToggle}
          />
        </Box>
      )}
      <Box flex={1} minWidth={0} flexDirection="column" rowGap="xs">
        <Text>{benefit.description}</Text>
        <Text variant="caption" color="muted">
          {[benefitDetail(benefit), where].filter(Boolean).join(' · ')}
        </Text>
      </Box>
    </Box>
  )
}
