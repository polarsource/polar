import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { eventsHref } from './eventsHref'
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
import { SidebarLink, SidebarRow, SidebarSection } from './FeatureSidebar'

export type Detail = schemas['FeatureDetail']
export type Customer = schemas['FeatureDetailCustomer']

export const TARGET_MARGIN = 0.7

export const customerName = (c: Customer) =>
  c.name ?? c.email ?? c.external_customer_id ?? 'Unknown'

export const share = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : ''

export const Economics = ({
  item,
  uses,
  currency,
}: {
  item: { cost: string | number; revenue: string | number }
  uses: number
  currency: string
}) => {
  const { revenue, cost, margin, marginRate } = economics(item)
  return (
    <>
      <SidebarSection title="Totals">
        <SidebarRow label="Revenue" value={formatAmount(revenue, currency)} />
        <SidebarRow label="Cost" value={formatAmount(cost, currency)} />
        <SidebarRow
          label="Margin"
          value={formatAmount(margin, currency)}
          detail={formatMarginRate(marginRate)}
          danger={margin < 0}
        />
        <SidebarRow label="Uses" value={formatCount(uses)} />
      </SidebarSection>
      <SidebarSection title="Per use">
        <SidebarRow
          label="Cost"
          value={formatUnitAmount(perUse(cost, uses), currency)}
        />
        <SidebarRow
          label="Revenue"
          value={formatUnitAmount(perUse(revenue, uses), currency)}
        />
      </SidebarSection>
    </>
  )
}

export const CustomerDetail = ({
  customer,
  detail,
  period,
  organizationSlug,
}: {
  customer: Customer
  detail: Detail
  period: { start_date: string; end_date: string }
  organizationSlug: string
}) => (
  <>
    <Economics
      item={customer}
      uses={customer.occurrences}
      currency={detail.currency}
    />
    <SidebarSection title="Customer">
      <SidebarRow label="Plan" value={customer.plan ?? 'Free'} />
      <SidebarRow
        label="Share of feature cost"
        value={share(Number(customer.cost), Number(detail.feature.cost))}
      />
      <SidebarRow
        label="Revenue across features"
        value={formatAmount(customer.total_revenue, detail.currency)}
      />
      {totalTokens(customer) > 0 && (
        <SidebarRow
          label="Tokens"
          value={formatTokens(totalTokens(customer))}
        />
      )}
    </SidebarSection>
    {customer.customer_id && (
      <SidebarSection title="Open">
        <SidebarLink
          href={buildCustomerDashboardPath(organizationSlug, {
            id: customer.customer_id,
            email: customer.email,
            name: customer.name,
          })}
        >
          Customer
        </SidebarLink>
        <SidebarLink
          href={`${eventsHref(organizationSlug, period, {
            eventTypes: [detail.feature.name],
          })}&customerIds=${customer.customer_id}`}
        >
          Events
        </SidebarLink>
      </SidebarSection>
    )}
  </>
)
