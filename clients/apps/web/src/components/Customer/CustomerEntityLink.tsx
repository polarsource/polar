'use client'

import { EntityLink } from '@/components/Shared/EntityLink'
import { type EntityMenuAction } from '@/components/Shared/EntityLinkMenu'
import { useFilterMenuItem } from '@/components/Shared/useFilterMenuItem'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'

interface LinkedCustomer {
  id: string
  name?: string | null
  email?: string | null
  external_id?: string | null
}

export const getCustomerLabel = (customer: LinkedCustomer) =>
  customer.name || customer.email || '—'

// What can be done with a customer from their link. In a list that filters
// by customer the list is narrowed down to them; anywhere else the way leads
// to their subscriptions.
export const useCustomerMenuItems = (
  organization: schemas['Organization'],
  customer: LinkedCustomer,
  filterable: boolean,
): EntityMenuAction[] => {
  const filter = useFilterMenuItem(
    'customer_id',
    customer.id,
    'Filter by this customer',
  )
  return [
    ...(filterable
      ? filter
      : [
          {
            label: 'View subscriptions',
            href: `/dashboard/${organization.slug}/sales/subscriptions?view=table&customer_id=${customer.id}`,
          },
        ]),
    { label: 'Copy customer ID', copy: customer.id },
    ...(customer.email ? [{ label: 'Copy email', copy: customer.email }] : []),
    ...(customer.external_id
      ? [{ label: 'Copy external ID', copy: customer.external_id }]
      : []),
  ]
}

// A customer as a link to their page, with a menu to copy their identifiers.
export const CustomerEntityLink = ({
  organization,
  customer,
  filterable = false,
  minimal,
}: {
  organization: schemas['Organization']
  customer: LinkedCustomer
  filterable?: boolean
  minimal?: boolean
}) => (
  <EntityLink
    kind="customer"
    minimal={minimal}
    href={buildCustomerDashboardPath(organization.slug, customer)}
    menuItems={useCustomerMenuItems(organization, customer, filterable)}
  >
    {getCustomerLabel(customer)}
  </EntityLink>
)
