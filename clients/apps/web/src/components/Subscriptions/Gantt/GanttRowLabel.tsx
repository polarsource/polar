import {
  getCustomerLabel,
  useCustomerMenuItems,
} from '@/components/Customer/CustomerEntityLink'
import {
  getProductHref,
  useProductMenuItems,
} from '@/components/Products/ProductEntityLink'
import { CombinedEntityLink } from '@/components/Shared/EntityLink'
import { useDashboardOrganization } from '@/hooks/dashboardOrganization'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { ROW_HEIGHT } from './scale'

interface GanttRowLabelProps {
  subscription: schemas['Subscription']
  className?: string
  onSelect: (id: string) => void
}

export const GanttRowLabel = ({
  subscription,
  className,
  onSelect,
}: GanttRowLabelProps) => {
  const organization = useDashboardOrganization()
  const { customer, product } = subscription
  const customerMenuItems = useCustomerMenuItems(organization, customer, true)
  const productMenuItems = useProductMenuItems(organization, product, true)
  return (
    // Not a button, so the customer and product can be links of their own.
    <div
      role="button"
      tabIndex={0}
      className={twMerge('block w-full cursor-pointer text-left', className)}
      data-row={subscription.id}
      onClick={() => onSelect(subscription.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(subscription.id)
      }}
    >
      <Box height={ROW_HEIGHT} alignItems="center" px="l" minWidth={0}>
        <CombinedEntityLink
          entities={[
            {
              kind: 'customer',
              href: buildCustomerDashboardPath(organization.slug, customer),
              name: getCustomerLabel(customer),
              menuItems: customerMenuItems,
            },
            {
              kind: 'product',
              href: getProductHref(organization, product),
              name: product.name,
              menuItems: productMenuItems,
              muted: true,
            },
          ]}
        />
      </Box>
    </div>
  )
}
