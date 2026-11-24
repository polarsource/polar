import { schemas } from '@polar-sh/client'
import { Checkbox, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useId } from 'react'
import { benefitDetail, TYPE_LABELS } from './benefitCopy'

type Benefit = schemas['MerchantMigrationBenefit']

// One audience: a heading, what they get, and an optional switch for the
// whole group.
export function BenefitSection({
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string
  description: string
  enabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  children: ReactNode
}) {
  const switchId = useId()
  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Box alignItems="start" justifyContent="between" columnGap="l">
        <Box flexDirection="column" rowGap="xs">
          <Text variant="label" as="h4">
            {title}
          </Text>
          <Text variant="caption" color="muted">
            {description}
          </Text>
        </Box>
        {onEnabledChange && (
          <Box as="label" htmlFor={switchId} alignItems="center" columnGap="s">
            <Text as="span" variant="caption" color="muted">
              {enabled ? 'On' : 'Off'}
            </Text>
            <Switch
              id={switchId}
              checked={enabled}
              aria-label={title}
              onCheckedChange={onEnabledChange}
            />
          </Box>
        )}
      </Box>
      <Box
        as="ul"
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        opacity={enabled === false ? 0.5 : 1}
      >
        {children}
      </Box>
    </Box>
  )
}

export function BenefitRow({
  benefit,
  aside,
  selected,
  onToggle,
}: {
  benefit: Benefit
  aside?: string
  selected?: boolean
  onToggle?: () => void
}) {
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
        <Text>
          {benefit.description}{' '}
          <Text as="span" color="muted">
            · {TYPE_LABELS[benefit.type]}
          </Text>
        </Text>
        <Text variant="caption" color="muted">
          {benefitDetail(benefit)}
        </Text>
      </Box>
      <Text variant="caption" color="muted">
        {benefit.benefit_id ? 'Created' : aside}
      </Text>
    </Box>
  )
}
