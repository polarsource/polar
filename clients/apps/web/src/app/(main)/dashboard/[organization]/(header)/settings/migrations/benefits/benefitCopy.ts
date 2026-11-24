import { schemas } from '@polar-sh/client'

type Benefit = schemas['MerchantMigrationBenefit']

export const TYPE_LABELS: Record<Benefit['type'], string> = {
  license_keys: 'License keys',
  downloadables: 'File downloads',
}

export function benefitDetail(benefit: Benefit): string {
  if (benefit.type === 'downloadables') {
    return benefit.files
      .map((file) => `${file.name} (${formatSize(file.size)})`)
      .join(', ')
  }
  const activations =
    benefit.activation_limit === null
      ? 'No activation limit'
      : `${benefit.activation_limit} activations`
  const expiry =
    benefit.expires_ttl === null || benefit.expires_timeframe === null
      ? 'never expires'
      : `expires after ${benefit.expires_ttl} ${benefit.expires_timeframe}${
          benefit.expires_ttl === 1 ? '' : 's'
        }`
  return `${activations} · ${expiry}`
}

export function productsText(benefit: Benefit): string {
  return benefit.products.length
    ? benefit.products.map((product) => product.name).join(', ')
    : 'One-time purchases only'
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export const NOT_MOVED = [
  'Activations already used on old keys. Customers activate again on Polar.',
  'A second key for the same product. A buyer keeps their first key.',
  'Key expiry dates. A key that expires starts its period again on Polar.',
]
