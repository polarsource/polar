import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { customerKey } from './featureEconomics'
import { SidebarHeader } from './FeatureSidebar'
import { CustomerDetail, customerName, Detail } from './SelectionCustomer'
import { PlanDetail, StepDetail } from './SelectionPlanStep'
import { FREE_PLAN, Selection } from './useSelection'

// The sidebar's view of whatever is picked in the customers, plans or steps
// table, or the fallback when it no longer exists in the data.
export const FeatureSelectionDetail = ({
  selection,
  detail,
  period,
  organizationSlug,
  onSelect,
  onClose,
  fallback,
}: {
  selection: Selection
  detail: Detail
  period: { start_date: string; end_date: string }
  organizationSlug: string
  onSelect: (selection: Selection) => void
  onClose: () => void
  fallback: ReactNode
}) => {
  if (selection.kind === 'customer') {
    const customer = detail.customers.find(
      (c) => customerKey(c) === selection.id,
    )
    if (!customer) return fallback
    return (
      <Box flexDirection="column">
        <SidebarHeader
          kind="Customer"
          title={customerName(customer)}
          onClose={onClose}
        />
        <CustomerDetail
          customer={customer}
          detail={detail}
          period={period}
          organizationSlug={organizationSlug}
        />
      </Box>
    )
  }
  if (selection.kind === 'plan') {
    const plan = detail.plans.find(
      (p) => (p.name ?? FREE_PLAN) === selection.id,
    )
    if (!plan) return fallback
    return (
      <Box flexDirection="column">
        <SidebarHeader
          kind="Plan"
          title={plan.name ?? 'Free'}
          onClose={onClose}
        />
        <PlanDetail
          plan={plan}
          detail={detail}
          onSelectCustomer={(c) =>
            onSelect({ kind: 'customer', id: customerKey(c) })
          }
        />
      </Box>
    )
  }
  const step = detail.steps.find((s) => s.name === selection.id)
  if (!step) return fallback
  return (
    <Box flexDirection="column">
      <SidebarHeader kind="Step" title={step.label} onClose={onClose} />
      <StepDetail
        step={step}
        detail={detail}
        period={period}
        organizationSlug={organizationSlug}
      />
    </Box>
  )
}
