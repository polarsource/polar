import { schemas } from '@polar-sh/client'
import { eventsHref } from './eventsHref'
import {
  customerKey,
  economics,
  formatAmount,
  formatCount,
  formatTokens,
  formatUnitAmount,
  perUse,
  totalTokens,
} from './featureEconomics'
import { SidebarLink, SidebarRow, SidebarSection } from './FeatureSidebar'
import {
  Customer,
  Detail,
  Economics,
  share,
  TARGET_MARGIN,
  customerName,
} from './SelectionCustomer'

export const PlanDetail = ({
  plan,
  detail,
  onSelectCustomer,
}: {
  plan: schemas['FeaturePlan']
  detail: Detail
  onSelectCustomer: (customer: Customer) => void
}) => {
  const customers = detail.customers
    .filter((c) => c.plan === plan.name)
    .toSorted((a, b) => Number(b.cost) - Number(a.cost))
  const unitCost = perUse(Number(plan.cost), plan.occurrences)
  return (
    <>
      <Economics
        item={plan}
        uses={plan.occurrences}
        currency={detail.currency}
      />
      <SidebarSection title="Pricing">
        <SidebarRow
          label={`Price for ${TARGET_MARGIN * 100}% margin`}
          value={formatUnitAmount(
            unitCost / (1 - TARGET_MARGIN),
            detail.currency,
          )}
        />
        <SidebarRow
          label="Share of feature cost"
          value={share(Number(plan.cost), Number(detail.feature.cost))}
        />
      </SidebarSection>
      <SidebarSection title={`Customers · ${formatCount(plan.customers)}`}>
        {customers.map((c) => (
          <button
            key={customerKey(c)}
            type="button"
            className="cursor-pointer text-left hover:opacity-70"
            onClick={() => onSelectCustomer(c)}
          >
            <SidebarRow
              label={customerName(c)}
              value={formatAmount(Number(c.cost), detail.currency)}
              danger={economics(c).margin < 0 && c.plan !== null}
            />
          </button>
        ))}
      </SidebarSection>
    </>
  )
}

export const StepDetail = ({
  step,
  detail,
  period,
  organizationSlug,
}: {
  step: schemas['FeatureStep']
  detail: Detail
  period: { start_date: string; end_date: string }
  organizationSlug: string
}) => {
  const uses = detail.feature.occurrences
  const cost = Number(step.cost)
  return (
    <>
      <SidebarSection title="Totals">
        <SidebarRow label="Cost" value={formatAmount(cost, detail.currency)} />
        <SidebarRow label="Runs" value={formatCount(step.occurrences)} />
        <SidebarRow
          label="Share of feature cost"
          value={share(cost, Number(detail.feature.cost))}
        />
      </SidebarSection>
      <SidebarSection title="Per use">
        <SidebarRow
          label="Cost"
          value={formatUnitAmount(perUse(cost, uses), detail.currency)}
        />
        <SidebarRow
          label="Runs"
          value={perUse(step.occurrences, uses).toFixed(2)}
        />
        <SidebarRow
          label="Cost per run"
          value={formatUnitAmount(
            perUse(cost, step.occurrences),
            detail.currency,
          )}
        />
      </SidebarSection>
      {totalTokens(step) > 0 && (
        <SidebarSection title="Tokens">
          <SidebarRow label="Input" value={formatTokens(step.input_tokens)} />
          <SidebarRow label="Output" value={formatTokens(step.output_tokens)} />
          <SidebarRow
            label="Per run"
            value={formatTokens(perUse(totalTokens(step), step.occurrences))}
          />
        </SidebarSection>
      )}
      <SidebarSection title="Open">
        <SidebarLink
          href={eventsHref(organizationSlug, period, {
            eventTypes: [step.name],
          })}
        >
          Events
        </SidebarLink>
      </SidebarSection>
    </>
  )
}
