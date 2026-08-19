import type { schemas } from '@polar-sh/client'
import { getUnitPrice } from '../guards'

export interface UnitRow {
  units: number
  pricePerUnit: number
}

export type UnitLabelSource = {
  unit_label?: schemas['ProductPriceUnitBased']['unit_label']
}

const resolveUnitLabelForms = (
  unitLabel: schemas['ProductPriceUnitBased']['unit_label'] | undefined,
  locale?: string,
): Record<string, string> => {
  const labels = Object.fromEntries(
    Object.entries(unitLabel ?? {}).map(([key, forms]) => [
      key.replace(/_/g, '-').toLowerCase(),
      forms,
    ]),
  )
  if (locale) {
    const requested = locale.replace(/_/g, '-').toLowerCase()
    const language = requested.split('-')[0]
    const forms = labels[requested] ?? labels[language]
    if (forms) {
      return forms
    }
  }
  return labels['en'] ?? Object.values(labels)[0] ?? {}
}

export function getUnitLabels(
  source?: UnitLabelSource | null,
  locale?: string,
): {
  unitLabel: string
  unitLabelPlural: string
} {
  const forms = resolveUnitLabelForms(source?.unit_label, locale)
  const unitLabel = forms['=1']?.trim() || forms['other']?.trim() || 'unit'
  const unitLabelPlural = forms['other']?.trim() || 'units'
  return { unitLabel, unitLabelPlural }
}

type UnitTier = schemas['Tier-Output']

function sortTiers(tiers: UnitTier[]): UnitTier[] {
  return tiers.toSorted((a, b) => {
    if (a.bound == null) return 1
    if (b.bound == null) return -1
    return a.bound - b.bound
  })
}

const toAmount = (value: string): number => Number(value)

export function getUnitRows(
  checkout: schemas['CheckoutPublic'],
): UnitRow[] | null {
  const price = getUnitPrice(checkout)
  if (!price) return null
  const units = checkout.units
  if (!units) return null

  const tiers = sortTiers(price.tiers.tiers)

  if (price.tiers.type === 'graduated') {
    const rows: UnitRow[] = []
    let allocated = 0
    for (const tier of tiers) {
      if (allocated >= units) break
      const tierEnd = tier.bound ?? units
      const unitsInTier = Math.min(units, tierEnd) - allocated
      if (unitsInTier > 0) {
        rows.push({
          units: unitsInTier,
          pricePerUnit: toAmount(tier.unit_amount),
        })
      }
      allocated += unitsInTier
    }
    return rows
  }

  const matchingTier = tiers.find((t) => t.bound == null || units <= t.bound)
  return [
    {
      units,
      pricePerUnit: toAmount(matchingTier?.unit_amount ?? '0'),
    },
  ]
}
