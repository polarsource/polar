import { schemas } from '@polar-sh/client'
import Link from 'next/link'
import {
  economics,
  FeatureSummary,
  formatAmount,
  formatCount,
  formatMarginRate,
  formatTokens,
  totalTokens,
} from './featureEconomics'
import { SidebarHeader, SidebarRow, SidebarSection } from './FeatureSidebar'
import { LegendRow, StackedBar } from './SidebarCharts'

const SLICES = 4

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

// The largest features by `value`, with the rest folded into one slice.
const slices = (
  features: FeatureSummary[],
  value: (feature: FeatureSummary) => number,
) => {
  const ranked = features
    .filter((feature) => value(feature) > 0)
    .toSorted((a, b) => value(b) - value(a))
  const rest = ranked.slice(SLICES)
  return [
    ...ranked
      .slice(0, SLICES)
      .map((feature) => ({ key: feature.label, value: value(feature) })),
    ...(rest.length > 0
      ? [
          {
            key: `${rest.length} more`,
            value: rest.reduce((sum, feature) => sum + value(feature), 0),
          },
        ]
      : []),
  ]
}

const Breakdown = ({
  title,
  parts,
  format,
}: {
  title: string
  parts: { key: string; value: number }[]
  format: (value: number) => string
}) => {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  if (total <= 0) return null
  return (
    <SidebarSection title={title}>
      <StackedBar segments={parts} />
      {parts.map((part, index) => (
        <LegendRow
          key={part.key}
          index={index}
          label={part.key}
          share={ratio(part.value, total)}
          value={format(part.value)}
        />
      ))}
    </SidebarSection>
  )
}

export const FeaturesOverviewSidebar = ({
  breakdown,
  featureHref,
}: {
  breakdown: schemas['FeatureBreakdown']
  featureHref: (name: string) => string
}) => {
  const { features, currency } = breakdown
  const { revenue, cost, margin, marginRate } = economics(breakdown)
  const uses = features.reduce((sum, f) => sum + f.occurrences, 0)
  const tokens = features.reduce((sum, f) => sum + totalTokens(f), 0)
  const losing = features
    .filter((f) => economics(f).margin < 0)
    .toSorted((a, b) => economics(a).margin - economics(b).margin)
  const unattributed = Number(breakdown.unattributed_revenue)
  const amount = (value: number) => formatAmount(value, currency)

  return (
    <>
      <SidebarHeader kind="Features" title="All features" />
      <SidebarSection title="Margin">
        <StackedBar
          segments={
            margin < 0
              ? [{ key: 'cost', value: cost, danger: true }]
              : [
                  { key: 'margin', value: margin },
                  { key: 'cost', value: cost },
                ]
          }
        />
        {margin < 0 ? (
          <SidebarRow
            label="Margin"
            value={amount(margin)}
            detail={formatMarginRate(marginRate)}
            danger
          />
        ) : (
          <LegendRow
            index={0}
            label="Margin"
            share={ratio(margin, revenue)}
            value={amount(margin)}
          />
        )}
        <LegendRow
          index={1}
          label="Cost"
          share={ratio(cost, revenue)}
          value={amount(cost)}
        />
        <SidebarRow label="Revenue" value={amount(revenue)} />
        {unattributed > 0 && (
          <SidebarRow
            label="Revenue without usage"
            value={amount(unattributed)}
          />
        )}
        <SidebarRow label="Uses" value={formatCount(uses)} />
        {tokens > 0 && (
          <SidebarRow label="Tokens" value={formatTokens(tokens)} />
        )}
      </SidebarSection>
      <Breakdown
        title="Cost by feature"
        parts={slices(features, (f) => Number(f.cost))}
        format={amount}
      />
      <Breakdown
        title="Revenue by feature"
        parts={slices(features, (f) => Number(f.revenue))}
        format={amount}
      />
      <Breakdown
        title="Tokens by feature"
        parts={slices(features, totalTokens)}
        format={formatTokens}
      />
      {losing.length > 0 && (
        <SidebarSection title="Losing money">
          {losing.map((f) => (
            <Link
              key={f.name}
              href={featureHref(f.name)}
              className="hover:opacity-70"
            >
              <SidebarRow
                label={f.label}
                value={amount(economics(f).margin)}
                detail={formatMarginRate(economics(f).marginRate)}
                danger
              />
            </Link>
          ))}
        </SidebarSection>
      )}
    </>
  )
}
