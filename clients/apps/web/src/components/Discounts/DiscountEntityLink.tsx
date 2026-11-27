'use client'

import { EntityLink } from '@/components/Shared/EntityLink'
import { useFilterMenuItem } from '@/components/Shared/useFilterMenuItem'
import { schemas } from '@polar-sh/client'
import { DiscountPreview } from './DiscountPreview'

interface LinkedDiscount {
  id: string
  name: string
  code?: string | null
}

// A discount as a link to the discounts list, with a card about it and a
// menu. In a list that filters by discount the list is narrowed down to it;
// anywhere else the way leads to its subscriptions.
export const DiscountEntityLink = ({
  organization,
  discount,
  filterable = false,
}: {
  organization: schemas['Organization']
  discount: LinkedDiscount
  filterable?: boolean
}) => {
  const filter = useFilterMenuItem(
    'discount_id',
    discount.id,
    'Filter by this discount',
  )
  return (
    <EntityLink
      kind="discount"
      href={`/dashboard/${organization.slug}/products/discounts${discount.code ? `?query=${encodeURIComponent(discount.code)}` : ''}`}
      menuItems={[
        ...(filterable
          ? filter
          : [
              {
                label: 'View subscriptions',
                href: `/dashboard/${organization.slug}/sales/subscriptions?view=table&discount_id=${discount.id}`,
              },
            ]),
        { label: 'Copy discount ID', copy: discount.id },
        ...(discount.code ? [{ label: 'Copy code', copy: discount.code }] : []),
      ]}
      preview={
        <DiscountPreview organization={organization} discountId={discount.id} />
      }
    >
      {discount.name}
    </EntityLink>
  )
}
