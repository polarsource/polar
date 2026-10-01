'use client'

import { Spinner, Text } from '@polar-sh/orbit'
import { BulkTaxProgress } from '../../bulkTax/BulkTaxProgress'
import type { MigrationSettingsSectionProps } from '../migrationSettingsSections'
import { TaxPriceExample } from './TaxPriceExample'
import { useTaxSetting } from './useTaxSetting'

export function TaxAfterSwitchSection({
  migrationId,
  onBusyChange,
}: MigrationSettingsSectionProps) {
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

  return <TaxPriceExample {...option} />
}
