'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import CheckoutButton from '@/components/Products/CheckoutButton'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { Slideshow } from '@/components/Products/Slideshow'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import {
  useRecurringInterval,
  useRecurringProductPrice,
} from '@/hooks/products'
import { useUserSubscriptions } from '@/hooks/queries'
import { CheckOutlined } from '@mui/icons-material'
import { Organization, Product } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export default function ClientPage({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) {
  const isRecurring = product.is_recurring

  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval([product])

  const recurringPrice = useRecurringProductPrice(product, recurringInterval)
  const oneTimePrice = product.prices.find((price) => price.type === 'one_time')
  const isFixedPrice = product.prices.every(
    (price) => price.amount_type === 'fixed',
  )

  const subscriptions = useUserSubscriptions({
    limit: 100,
    organizationId: organization.id,
  })

  const currentSubscription = subscriptions.data?.items.find(
    (sub) => sub.product_id === product.id,
  )

  return (
    <div className="flex flex-col items-start justify-between gap-8 pb-8 md:flex-row md:gap-12 md:pb-0">
      <div className="flex w-full flex-col gap-8">
        {product.medias.length > 0 && (
          <Slideshow
            images={product.medias.map(({ public_url }) => public_url)}
          />
        )}
        <ShadowBox className="flex flex-col gap-6 ring-gray-100">
          <h1 className="text-2xl font-medium">{product.name}</h1>
          {product.description ? (
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
                {product.description}
              </Markdown>
            </div>
          ) : (
            <></>
          )}
        </ShadowBox>
      </div>
      <div className="flex w-full flex-col items-center gap-8 md:sticky md:top-16 md:max-w-xs">
        {hasBothIntervals && (
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        )}
        <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
          <h3 className="text-lg font-medium">{product.name}</h3>
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-light">
              {recurringPrice ? (
                <ProductPriceLabel price={recurringPrice} />
              ) : (
                oneTimePrice && <ProductPriceLabel price={oneTimePrice} />
              )}
            </h1>
            {isFixedPrice && (
              <p className="dark:text-polar-500 text-sm text-gray-400">
                Before VAT and taxes
              </p>
            )}
          </div>
          {product.benefits.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="font-medium dark:text-white">Included</h1>
              </div>
              {product.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-start gap-x-3 align-middle"
                >
                  <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
                  {resolveBenefitIcon(benefit, 'small', 'h-3 w-3')}
                  </span>
                  <span className="text-sm">{benefit.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <></>
          )}
          <div className="flex flex-col gap-4">
            {isRecurring ? (
              <>
                {currentSubscription ? (
                  <Link
                    className="w-full"
                    href={`/purchases/subscriptions/${currentSubscription.id}`}
                  >
                    <Button size="lg" fullWidth>
                      View Subscription
                    </Button>
                  </Link>
                ) : (
                  <CheckoutButton
                    product={product}
                    recurringInterval={recurringInterval}
                    organization={organization}
                    checkoutPath="/api/checkout"
                    variant="default"
                  >
                    Subscribe Now
                  </CheckoutButton>
                )}
              </>
            ) : (
              <CheckoutButton
                product={product}
                organization={organization}
                checkoutPath="/api/checkout"
                variant="default"
              >
                Buy Now
              </CheckoutButton>
            )}
          </div>
        </ShadowBox>
      </div>
    </div>
  )
}
