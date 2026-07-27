'use client'

import { DetailCell, DetailGrid } from '@/components/Orders/OrderSection'
import { useProduct } from '@/hooks/queries'
import { useClearPendingSubscriptionUpdate } from '@/hooks/queries/subscriptions'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'

export const ScheduledUpdateSection = ({
  pendingUpdate,
  subscription,
}: {
  pendingUpdate: schemas['PendingSubscriptionUpdate']
  subscription: schemas['Subscription']
}) => {
  const { organization } = useContext(OrganizationContext)
  const { data: newProduct } = useProduct(pendingUpdate.product_id ?? undefined)
  const clearPendingUpdate = useClearPendingSubscriptionUpdate(subscription.id)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text variant="heading-xxs" as="h3">
          Scheduled update
        </Text>
        <Button
          variant="secondary"
          onClick={() => setShowConfirmModal(true)}
          loading={clearPendingUpdate.isPending}
        >
          Cancel scheduled change
        </Button>
      </Box>

      <DetailGrid>
        {newProduct && (
          <DetailCell
            label="New product"
            value={
              <Link
                href={`/dashboard/${organization.slug}/products/${newProduct.id}`}
              >
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  columnGap="s"
                >
                  <Text as="span" variant="body" truncate>
                    {newProduct.name}
                  </Text>
                  <Box as="span" display="inline-flex">
                    <ArrowUpRightIcon size={16} />
                  </Box>
                </Box>
              </Link>
            }
          />
        )}
        {pendingUpdate.seats !== null && (
          <DetailCell
            label="New seats"
            value={`${subscription.seats ?? 0} → ${pendingUpdate.seats}`}
          />
        )}
        <DetailCell
          label="Will be applied on"
          value={
            <Text variant="body" as="span">
              <FormattedDateTime datetime={pendingUpdate.applies_at} />
            </Text>
          }
        />
      </DetailGrid>

      <ConfirmModal
        isShown={showConfirmModal}
        hide={() => setShowConfirmModal(false)}
        title="Cancel scheduled change"
        description="The customer's subscription will remain unchanged on the next billing cycle. Are you sure you want to cancel this pending update?"
        onConfirm={() => clearPendingUpdate.mutateAsync()}
      />
    </Box>
  )
}
