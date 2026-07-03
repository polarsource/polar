'use client'

import {
  DASHBOARD_PRODUCTS,
  DashboardProduct,
  useCurrentProduct,
} from '@/components/Dashboard/navigationProducts'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { SidebarSwitcher } from './SidebarSwitcher'

export const ProductSwitcher = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const current = useCurrentProduct(organization)

  return (
    <SidebarSwitcher
      options={DASHBOARD_PRODUCTS.map((product) => ({
        value: product.id,
        label: product.label,
      }))}
      value={current}
      onChange={(value: DashboardProduct) => {
        const product = DASHBOARD_PRODUCTS.find((p) => p.id === value)
        if (product) router.push(product.landing(organization.slug))
      }}
    />
  )
}
