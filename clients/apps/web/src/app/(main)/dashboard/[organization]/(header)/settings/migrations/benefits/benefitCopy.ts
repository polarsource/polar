import { formatFileSize } from '@/components/Chat/fileUtils'
import { schemas } from '@polar-sh/client'
import { plural } from '../review/importSummary'

type Benefit = schemas['MerchantMigrationBenefit']

export const TYPE_LABELS: Record<Benefit['type'], string> = {
  license_keys: 'License keys',
  downloadables: 'File downloads',
  custom: 'Links',
}

export function benefitDetail(benefit: Benefit): string {
  if (benefit.type === 'custom') {
    return benefit.links.join(', ')
  }
  if (benefit.type === 'downloadables') {
    return benefit.files
      .map((file) => `${file.name} (${formatFileSize(file.size)})`)
      .join(', ')
  }
  const activations =
    benefit.activation_limit === null
      ? 'No activation limit'
      : plural(benefit.activation_limit, 'activation')
  const expiry =
    benefit.expires_ttl === null || benefit.expires_timeframe === null
      ? 'never expires'
      : `expires after ${plural(benefit.expires_ttl, benefit.expires_timeframe)}`
  return `${activations} · ${expiry}`
}

export function productsText(benefit: Benefit): string {
  return benefit.products.length
    ? benefit.products.map((product) => product.name).join(', ')
    : 'No imported product'
}

export const NOT_MOVED = [
  'Activations already used on old keys. Customers activate again on Polar.',
  'A second key for the same product. A buyer keeps their first key.',
  'Key expiry dates. A key that expires starts its period again on Polar.',
]
