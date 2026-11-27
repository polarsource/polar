'use client'

import {
  EntityPreview,
  EntityPreviewRow,
  EntityPreviewSection,
  EntityPreviewTitle,
} from '@/components/Shared/EntityPreview'
import { useDiscount } from '@/hooks/queries/discounts'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { format } from 'date-fns'

const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy')

const getDuration = (discount: schemas['Discount']) => {
  if (discount.duration === 'once') return 'Applies once'
  if (discount.duration === 'forever') return 'Applies forever'
  const months =
    'duration_in_months' in discount ? discount.duration_in_months : 0
  return `Applies for ${months} ${months === 1 ? 'month' : 'months'}`
}

// What a discount link shows while it is pointed at: how much it takes off,
// for how long, and how much it has been used. Loaded when the card opens.
export const DiscountPreview = ({
  organization,
  discountId,
}: {
  organization: schemas['Organization']
  discountId: string
}) => {
  const { data: discount, isError } = useDiscount(organization.id, discountId)
  return (
    <EntityPreview isLoading={!discount} isError={isError}>
      {discount && (
        <>
          <EntityPreviewSection>
            <EntityPreviewTitle
              title={discount.name}
              aside={getDiscountDisplay(discount)}
            />
            <Text color="muted">{getDuration(discount)}</Text>
          </EntityPreviewSection>
          <EntityPreviewSection divided>
            {discount.code && (
              <EntityPreviewRow label="Code">{discount.code}</EntityPreviewRow>
            )}
            <EntityPreviewRow label="Redemptions">
              {discount.redemptions_count}
              {discount.max_redemptions ? ` / ${discount.max_redemptions}` : ''}
            </EntityPreviewRow>
            {discount.starts_at && (
              <EntityPreviewRow label="Starts">
                {formatDate(discount.starts_at)}
              </EntityPreviewRow>
            )}
            {discount.ends_at && (
              <EntityPreviewRow label="Ends">
                {formatDate(discount.ends_at)}
              </EntityPreviewRow>
            )}
          </EntityPreviewSection>
        </>
      )}
    </EntityPreview>
  )
}
