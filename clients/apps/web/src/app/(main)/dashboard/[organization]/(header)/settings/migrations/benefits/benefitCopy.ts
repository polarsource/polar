import { formatFileSize } from '@/components/Chat/fileUtils'
import { schemas } from '@polar-sh/client'
import { plural } from '../review/importSummary'

type Benefit = schemas['MerchantMigrationBenefit']

export function benefitDetail(benefit: Benefit): string {
  if (benefit.type === 'custom') {
    return benefit.link_titles.join(', ')
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
