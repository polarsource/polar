'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerOrderInvoice,
} from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { Client, components } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useCallback } from 'react'

const CustomerPortalOrder = ({
  api,
  order,
}: {
  api: Client
  order: components['schemas']['CustomerOrder']
}) => {
  const organization = order.product.organization
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    order_id: order.id,
    limit: 100,
    sorting: ['type'],
  })

  const orderInvoiceMutation = useCustomerOrderInvoice(api)
  const openInvoice = useCallback(async () => {
    const { url } = await orderInvoiceMutation.mutateAsync({ id: order.id })
    window.open(url, '_blank')
  }, [orderInvoiceMutation, order])

  return (
    <>
      <div className="flex h-full flex-col gap-12">
        <div className="flex w-full flex-col gap-8">
          {(benefitGrants?.items.length ?? 0) > 0 && (
            <div className="flex flex-col gap-4">
              <List>
                {benefitGrants?.items.map((benefitGrant) => (
                  <ListItem
                    key={benefitGrant.id}
                    className="py-6 hover:bg-transparent dark:hover:bg-transparent"
                  >
                    <BenefitGrant api={api} benefitGrant={benefitGrant} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}

          <ShadowBox className="flex flex-col gap-8 dark:border-transparent">
            <h3 className="text-lg font-medium">{order.product.name}</h3>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-light">
                {formatCurrencyAndAmount(order.amount, order.currency, 0)}
              </h1>
              <p className="dark:text-polar-500 text-sm text-gray-400">
                Purchased on{' '}
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                fullWidth
                onClick={openInvoice}
                loading={orderInvoiceMutation.isPending}
                disabled={orderInvoiceMutation.isPending}
              >
                Download Invoice
              </Button>
              {organization &&
                organization.profile_settings?.enabled &&
                !order.product.is_archived && (
                  <Link
                    href={organizationPageLink(
                      organization,
                      `products/${order.product.id}`,
                    )}
                  >
                    <Button size="lg" variant="ghost" fullWidth>
                      Go to Product
                    </Button>
                  </Link>
                )}
            </div>
          </ShadowBox>
        </div>

        <div className="flex w-full flex-col gap-8"></div>
      </div>
    </>
  )
}

export default CustomerPortalOrder
