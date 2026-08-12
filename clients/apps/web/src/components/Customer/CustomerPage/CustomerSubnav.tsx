'use client'

import { schemas } from '@polar-sh/client'
import { Subnav, SubnavItem } from '@polar-sh/orbit'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { isCustomerMembersEnabled } from './isCustomerMembersEnabled'
import { CUSTOMER_METRICS_QUERY_PARAMS } from './useCustomerMetricsParams'

interface CustomerSubnavProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerSubnav = ({
  organization,
  customer,
}: CustomerSubnavProps) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const base = `/dashboard/${organization.slug}/customers/${customer.id}`

  const items = [
    { label: 'Overview', href: base },
    { label: 'Usage', href: `${base}/usage` },
    { label: 'Events', href: `${base}/events` },
    { label: 'Costs', href: `${base}/costs` },
    ...(isCustomerMembersEnabled(organization, customer)
      ? [{ label: 'Members', href: `${base}/members` }]
      : []),
  ]

  const metricsParams = new URLSearchParams()
  for (const key of CUSTOMER_METRICS_QUERY_PARAMS) {
    const value = searchParams.get(key)
    if (value) {
      metricsParams.set(key, value)
    }
  }
  const query = metricsParams.size > 0 ? `?${metricsParams.toString()}` : ''

  return (
    <Subnav label="Customer sections">
      {items.map(({ label, href }) => (
        <SubnavItem key={href} active={pathname === href}>
          <Link href={`${href}${query}`}>{label}</Link>
        </SubnavItem>
      ))}
    </Subnav>
  )
}
