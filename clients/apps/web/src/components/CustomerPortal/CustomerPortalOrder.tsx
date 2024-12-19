'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerOrderInvoice,
} from '@/hooks/queries'
import { markdownOptions } from '@/utils/markdown'
import { organizationPageLink } from '@/utils/nav'
import { CustomerOrder, PolarAPI } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback } from 'react'

const CustomerPortalOrder = ({
  api,
  order,
}: {
  api: PolarAPI
  order: CustomerOrder
}) => {
  const organization = order.product.organization
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    orderId: order.id,
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
          <h1 className="text-3xl font-medium">{order.product.name}</h1>
          {order.product.description ? (
            <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
              <Markdown options={markdownOptions}>
                {order.product.description}
              </Markdown>
            </div>
          ) : (
            <></>
          )}

          <ShadowBox className="flex flex-col gap-8">
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

          {(benefitGrants?.items.length ?? 0) > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium">Benefits</h3>
              <List>
                {benefitGrants?.items.map((benefitGrant) => (
                  <ListItem key={benefitGrant.id}>
                    <BenefitGrant api={api} benefitGrant={benefitGrant} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8"></div>
      </div>
    </>
  )
}

export default CustomerPortalOrder
