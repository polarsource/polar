import { schemas } from '@polar-sh/client'
import { useFeatureEconomics } from '@/hooks/queries/featureBreakdown'
import { parseAsString, useQueryState } from 'nuqs'
import { featureFindings } from './FeatureAttention'
import { useFeatureRange } from './useFeatureRange'

// One feature's economics over the picked range, plus the customer segment
// picked in the chips. Both live in the URL.
export const useFeature = (
  organization: schemas['Organization'],
  name: string,
) => {
  const range = useFeatureRange(organization)
  const query = useFeatureEconomics(organization.id, name, {
    ...range.period,
    interval: range.interval,
  })
  const [segment, setSegment] = useQueryState('segment', parseAsString)
  const findings = query.data ? featureFindings(query.data.customers) : []
  const finding = findings.find((item) => item.id === segment) ?? null
  return {
    ...query,
    range,
    period: range.period,
    findings,
    finding,
    setSegment: (id: string | null) => setSegment(id),
  }
}
