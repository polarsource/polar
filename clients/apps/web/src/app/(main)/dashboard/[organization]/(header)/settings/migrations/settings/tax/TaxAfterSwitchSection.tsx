'use client'

import { Spinner, Text } from '@polar-sh/orbit'
import { useSearchParams } from 'next/navigation'
import { BulkTaxProgress } from '../../bulkTax/BulkTaxProgress'
import type { MigrationSettingsSectionProps } from '../migrationSettingsSections'
import { TaxOptionCards } from './TaxOptionCards'
import { TaxOptionExample } from './TaxOptionExample'
import { TaxOptionRow } from './TaxOptionRow'
import { TaxOptionSentence } from './TaxOptionSentence'
import { TaxOptionToggle } from './TaxOptionToggle'
import { TaxOptionProps, useTaxSetting } from './useTaxSetting'

// Temporary: `?taxOption=1..5` picks which layout to compare.
const useTaxOption = () => Number(useSearchParams().get('taxOption')) || 1

function TaxOption({ index, ...props }: TaxOptionProps & { index: number }) {
  switch (index) {
    case 2:
      return <TaxOptionSentence {...props} />
    case 3:
      return <TaxOptionToggle {...props} />
    case 4:
      return <TaxOptionExample {...props} />
    case 5:
      return <TaxOptionRow {...props} />
    default:
      return <TaxOptionCards {...props} />
  }
}

export function TaxAfterSwitchSection({
  migrationId,
  onBusyChange,
}: MigrationSettingsSectionProps) {
  const index = useTaxOption()
  const { breakdown, controller, option } = useTaxSetting(
    migrationId,
    onBusyChange,
  )

  if (!option) {
    return breakdown.isError ? (
      <Text variant="caption" color="error">
        We couldn&apos;t load your subscriptions.
      </Text>
    ) : (
      <Spinner />
    )
  }

  if (controller.state.phase !== 'idle') {
    return (
      <BulkTaxProgress controller={controller} onDismiss={controller.reset} />
    )
  }

  return <TaxOption index={index} {...option} />
}
