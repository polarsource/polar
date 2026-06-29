'use client'

import { useBenefit, useBenefits } from '@/hooks/queries/benefits'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import { useMemo, useState } from 'react'
import {
  STANDALONE_ASSIGNABLE_BENEFIT_TYPES,
  benefitsDisplayNames,
  resolveBenefitIcon,
} from './utils'

export default function BenefitSelector({
  organizationId,
  value,
  onChange,
  excludeIds,
  className,
  placeholder = 'Select a benefit',
}: {
  organizationId: string
  value: string | null
  onChange: (
    benefitId: string | null,
    benefit?: schemas['Benefit'] | null,
  ) => void
  excludeIds?: string[]
  className?: string
  placeholder?: string
}) {
  const [query, setQuery] = useState('')

  const { data: benefits, isLoading } = useBenefits(organizationId, {
    query: query || undefined,
    type: [...STANDALONE_ASSIGNABLE_BENEFIT_TYPES],
    sorting: ['description'],
    limit: 30,
  })

  const items = useMemo(
    () =>
      (benefits?.items ?? []).filter(
        (benefit) => !excludeIds?.includes(benefit.id),
      ),
    [benefits?.items, excludeIds],
  )

  const { data: selectedBenefit } = useBenefit(value ?? '')

  return (
    <Combobox
      items={items}
      value={value}
      selectedItem={
        selectedBenefit ??
        items.find((benefit) => benefit.id === value) ??
        null
      }
      onChange={(benefitId) =>
        onChange(
          benefitId,
          items.find((benefit) => benefit.id === benefitId) ?? null,
        )
      }
      onQueryChange={setQuery}
      getItemValue={(benefit) => benefit.id}
      getItemLabel={(benefit) => benefit.description}
      renderItem={(benefit) => (
        <Box alignItems="center" columnGap="m">
          <Box
            alignItems="center"
            justifyContent="center"
            width={36}
            height={36}
            borderRadius="m"
            backgroundColor="background-card"
            color="text-secondary"
            flexShrink={0}
          >
            {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
          </Box>
          <Box flexDirection="column">
            <Text variant="default" color="inherit">
              {benefit.description}
            </Text>
            <Text variant="caption" color="inherit" style={{ opacity: 0.6 }}>
              {benefitsDisplayNames[benefit.type]}
            </Text>
          </Box>
        </Box>
      )}
      isLoading={isLoading}
      placeholder={placeholder}
      searchPlaceholder="Search benefits..."
      emptyLabel="No grantable benefits found"
      className={className}
    />
  )
}
