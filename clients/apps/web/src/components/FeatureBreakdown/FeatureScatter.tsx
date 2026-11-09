import { useRouter } from 'next/navigation'
import { EconomicsScatter } from './EconomicsScatter'
import { economics, FeatureSummary } from './featureEconomics'

// Each feature's cost against its revenue.
export const FeatureScatter = ({
  features,
  currency,
  hovered,
  onHover,
  featureHref,
}: {
  features: FeatureSummary[]
  currency: string
  hovered: string | null
  onHover: (name: string | null) => void
  featureHref: (name: string) => string
}) => {
  const router = useRouter()
  return (
    <EconomicsScatter
      points={features.map((feature) => ({
        key: feature.name,
        label: feature.label,
        ...economics(feature),
      }))}
      currency={currency}
      focus={null}
      hovered={hovered}
      onHover={onHover}
      onSelect={(name) => router.push(featureHref(name))}
    />
  )
}
