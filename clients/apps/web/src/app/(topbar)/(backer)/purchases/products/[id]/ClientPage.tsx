'use client'

import BenefitDetails from '@/components/Benefit/BenefitDetails'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import { InlineModal } from '@/components/Modal/InlineModal'
import {
  useOrganization,
  useUserBenefits,
  useUserOrderInvoice,
} from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { ArrowBackOutlined } from '@mui/icons-material'
import { UserBenefit, UserOrder } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback, useState } from 'react'

const ClientPage = ({ order }: { order: UserOrder }) => {
  const { data: organization } = useOrganization(order.product.organization_id)
  const { data: benefits } = useUserBenefits({
    orderId: order.id,
    limit: 100,
    sorting: ['type'],
  })

  const [selectedBenefit, setSelectedBenefit] = useState<UserBenefit | null>(
    null,
  )

  const orderInvoiceMutation = useUserOrderInvoice()
  const openInvoice = useCallback(async () => {
    const { url } = await orderInvoiceMutation.mutateAsync(order.id)
    window.open(url, '_blank')
  }, [orderInvoiceMutation, order])

  return (
    <div className="flex flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-2 self-start text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/purchases/products`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Purchases</span>
      </Link>
      <div className="flex h-full flex-grow flex-col-reverse gap-12 md:flex-row md:items-start">
        <div className="flex w-full flex-col gap-8 md:w-2/3">
          <ShadowBox className="flex flex-col gap-6 ring-gray-100">
            <h1 className="text-2xl font-medium">{order.product.name}</h1>
            {order.product.description ? (
              <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
                <Markdown
                  options={{
                    ...markdownOpts,
                    overrides: {
                      ...markdownOpts.overrides,
                      a: (props) => (
                        <a {...props} rel="noopener noreferrer nofollow" />
                      ),
                    },
                  }}
                >
                  {order.product.description}
                </Markdown>
              </div>
            ) : (
              <></>
            )}
          </ShadowBox>
          {benefits?.items && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium">Benefits</h3>
              <List>
                {benefits.items.map((benefit) => (
                  <ListItem
                    key={benefit.id}
                    selected={benefit.id === selectedBenefit?.id}
                    onSelect={() => setSelectedBenefit(benefit)}
                  >
                    <BenefitRow benefit={benefit} order={order} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8 md:max-w-[340px]">
          <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
            <h3 className="text-lg font-medium">{order.product.name}</h3>
            <div className="flex flex-col gap-4">
              <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
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
              {organization && organization.profile_settings?.enabled && (
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
      </div>
      <InlineModal
        isShown={selectedBenefit !== null}
        hide={() => setSelectedBenefit(null)}
        modalContent={
          <div className="px-8 py-10">
            {selectedBenefit && (
              <BenefitDetails benefit={selectedBenefit} order={order} />
            )}
          </div>
        }
      />
    </div>
  )
}

export default ClientPage
