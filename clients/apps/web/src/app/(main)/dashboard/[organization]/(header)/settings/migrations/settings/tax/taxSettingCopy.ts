import { TaxBehavior } from '../../bulkTax/bulkTaxRecords'

export const TAX_SETTING_LABELS: Record<TaxBehavior, string> = {
  inclusive: 'Tax included in the price',
  exclusive: 'Tax added on top',
}

export const TAX_SETTING_HINTS: Record<TaxBehavior, string> = {
  inclusive: 'Customers keep paying what they pay today.',
  exclusive:
    "Customers pay the price plus tax, so they'll pay more than they do today.",
}

export const TAX_SETTING_MIXED =
  'Right now some subscriptions include tax and some add it on top.'

export const APPLY_LABEL = 'Apply to all'
export const APPLIED_LABEL = 'Already applied'
