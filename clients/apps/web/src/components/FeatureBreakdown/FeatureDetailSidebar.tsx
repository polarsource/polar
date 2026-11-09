import { schemas } from '@polar-sh/client'
import {
  economics,
  formatAmount,
  formatCount,
  formatMarginRate,
  formatTokens,
  formatUnitAmount,
  perUse,
  totalTokens,
} from './featureEconomics'
import {
  SidebarHeader,
  SidebarRow,
  SidebarSection,
  SidebarShareRow,
} from './FeatureSidebar'
import { customerName, TARGET_MARGIN } from './SelectionCustomer'
import { LegendRow, StackedBar } from './SidebarCharts'

const TOP = 5
const MODELS = 4

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
const costOf = (rows: { cost: string }[]) =>
  rows.reduce((sum, row) => sum + Number(row.cost), 0)

export const FeatureDetailSidebar = ({
  detail,
}: {
  detail: schemas['FeatureDetail']
}) => {
  const { feature, currency, models, customers } = detail
  const uses = feature.occurrences
  const { revenue, cost, margin, marginRate } = economics(feature)
  const tokens = totalTokens(feature)
  const unitCost = perUse(cost, uses)
  const byCost = customers.toSorted((a, b) => Number(b.cost) - Number(a.cost))
  const top = costOf(byCost.slice(0, TOP))
  const losing = customers.filter((c) => economics(c).margin < 0)
  const free = customers.filter((c) => c.plan === null)
  const ranked = models
    .filter((model) => Number(model.cost) > 0)
    .toSorted((a, b) => Number(b.cost) - Number(a.cost))
  const modelCost = costOf(ranked)
  const rest = ranked.slice(MODELS)
  const modelSlices = [
    ...ranked
      .slice(0, MODELS)
      .map((model) => ({ key: model.model, value: Number(model.cost) })),
    ...(rest.length > 0
      ? [{ key: `${rest.length} more`, value: costOf(rest) }]
      : []),
  ]

  return (
    <>
      <SidebarHeader kind="Feature" title={feature.label} />
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
          <>
            <SidebarRow
              label="Margin"
              value={formatAmount(margin, currency)}
              detail={formatMarginRate(marginRate)}
              danger
            />
            <SidebarRow label="Cost" value={formatAmount(cost, currency)} />
          </>
        ) : (
          <>
            <LegendRow
              index={0}
              label="Margin"
              share={ratio(margin, revenue)}
              value={formatAmount(margin, currency)}
            />
            <LegendRow
              index={1}
              label="Cost"
              share={ratio(cost, revenue)}
              value={formatAmount(cost, currency)}
            />
          </>
        )}
        <SidebarRow label="Revenue" value={formatAmount(revenue, currency)} />
        <SidebarRow label="Uses" value={formatCount(uses)} />
        <SidebarRow
          label="Customers"
          value={formatCount(feature.customers)}
          detail={`${formatCount(feature.paying_customers)} paying`}
        />
      </SidebarSection>
      <SidebarSection title="Per use">
        <SidebarRow label="Cost" value={formatUnitAmount(unitCost, currency)} />
        <SidebarRow
          label="Revenue"
          value={formatUnitAmount(perUse(revenue, uses), currency)}
        />
        <SidebarRow
          label={`Price for ${TARGET_MARGIN * 100}% margin`}
          value={formatUnitAmount(unitCost / (1 - TARGET_MARGIN), currency)}
        />
      </SidebarSection>
      {modelSlices.length > 0 && (
        <SidebarSection title="Cost by model">
          <StackedBar segments={modelSlices} />
          {modelSlices.map((slice, index) => (
            <LegendRow
              key={slice.key}
              index={index}
              label={slice.key}
              share={ratio(slice.value, modelCost)}
              value={formatAmount(slice.value, currency)}
            />
          ))}
        </SidebarSection>
      )}
      {cost > 0 && customers.length > 1 && (
        <SidebarSection title="Cost by customer">
          <SidebarShareRow
            label={customerName(byCost[0])}
            share={ratio(Number(byCost[0].cost), cost)}
            value={formatAmount(Number(byCost[0].cost), currency)}
          />
          {customers.length > TOP && ratio(top, cost) < 0.99 && (
            <SidebarShareRow
              label={`Top ${TOP}`}
              share={ratio(top, cost)}
              value={formatAmount(top, currency)}
            />
          )}
          {losing.length > 0 && (
            <SidebarShareRow
              label={`Losing money · ${formatCount(losing.length)}`}
              share={ratio(costOf(losing), cost)}
              value={formatAmount(costOf(losing), currency)}
            />
          )}
          {free.length > 0 && (
            <SidebarShareRow
              label={`Free · ${formatCount(free.length)}`}
              share={ratio(costOf(free), cost)}
              value={formatAmount(costOf(free), currency)}
            />
          )}
        </SidebarSection>
      )}
      {tokens > 0 && (
        <SidebarSection title="Tokens">
          <StackedBar
            segments={[
              { key: 'input', value: feature.input_tokens },
              { key: 'output', value: feature.output_tokens },
            ]}
          />
          <LegendRow
            index={0}
            label="Input"
            share={ratio(feature.input_tokens, tokens)}
            value={formatTokens(feature.input_tokens)}
          />
          <LegendRow
            index={1}
            label="Output"
            share={ratio(feature.output_tokens, tokens)}
            value={formatTokens(feature.output_tokens)}
          />
          <SidebarRow
            label="Per use"
            value={formatTokens(perUse(tokens, uses))}
          />
        </SidebarSection>
      )}
    </>
  )
}
