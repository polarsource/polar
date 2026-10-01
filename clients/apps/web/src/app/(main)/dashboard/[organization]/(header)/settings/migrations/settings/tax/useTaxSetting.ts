import { useAllMigrationRecords } from '@/hooks/queries/merchantMigrations'
import { useEffect, useEffectEvent } from 'react'
import {
  TaxBehavior,
  TaxBreakdown,
  taxBreakdown,
} from '../../bulkTax/bulkTaxRecords'
import { useBulkTaxUpdate } from '../../bulkTax/useBulkTaxUpdate'

type TaxCurrent = TaxBehavior | 'mixed'

export interface TaxSettingProps {
  current: TaxCurrent
  canApply: (target: TaxBehavior) => boolean
  onApply: (target: TaxBehavior) => void
}

function currentTax(counts: TaxBreakdown): TaxCurrent {
  if (counts.undecided === 0 && counts.exclusive === 0) return 'inclusive'
  if (counts.undecided === 0 && counts.inclusive === 0) return 'exclusive'
  return 'mixed'
}

const affected = (counts: TaxBreakdown, target: TaxBehavior) =>
  counts.undecided +
  (target === 'exclusive' ? counts.inclusive : counts.exclusive)

export const initialChoice = (current: TaxCurrent): TaxBehavior =>
  current === 'mixed' ? 'inclusive' : current

export function useTaxSetting(
  migrationId: string,
  onBusyChange: (busy: boolean) => void,
) {
  const breakdown = useAllMigrationRecords(
    migrationId,
    'subscriptions',
    taxBreakdown,
  )
  const controller = useBulkTaxUpdate(migrationId)
  const notifyBusy = useEffectEvent(onBusyChange)

  useEffect(() => {
    notifyBusy(controller.busy)
  }, [controller.busy])

  const counts = breakdown.data
  const option: TaxSettingProps | null = counts
    ? {
        current: currentTax(counts),
        canApply: (target) => affected(counts, target) > 0,
        onApply: (target) => controller.start(target),
      }
    : null

  return { breakdown, controller, option }
}
