'use client'

import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'
import { Subnav, SubnavItem } from '@polar-sh/orbit'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface CustomersSubnavProps {
  organization: schemas['Organization']
}

export const CustomersSubnav = ({ organization }: CustomersSubnavProps) => {
  const pathname = usePathname()
  const canReadAnalytics = useHasPermission(organization.id, 'analytics:read')
  const base = `/dashboard/${organization.slug}/customers`

  const items = [
    { label: 'Overview', href: base },
    { label: 'Top Customers', href: `${base}/top` },
    { label: 'At Risk', href: `${base}/at-risk` },
    ...(canReadAnalytics
      ? [{ label: 'Cost Drivers', href: `${base}/cost-drivers` }]
      : []),
  ]

  return (
    <Subnav label="Customer sections">
      {items.map(({ label, href }) => (
        <SubnavItem key={href} active={pathname === href}>
          <Link href={href}>{label}</Link>
        </SubnavItem>
      ))}
    </Subnav>
  )
}
