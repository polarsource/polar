import {
  resolveBenefitIcon,
  resolveBenefitTypeDisplayName,
} from '@/components/Benefit/utils'
import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import CheckoutButton from '@/components/Products/CheckoutButton'
import ProductPrices from '@/components/Products/ProductPrices'
import { Slideshow } from '@/components/Products/Slideshow'
import { Organization, Product } from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import Markdown from 'markdown-to-jsx'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function ClientPage({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) {
  const isRecurring = product.is_recurring
  const monthlyPrice = product.prices.find(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'month',
  )
  const yearlyPrice = product.prices.find(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'year',
  )

  const yearlyDiscount =
    yearlyPrice &&
    yearlyPrice.amount_type === 'fixed' &&
    monthlyPrice &&
    monthlyPrice.amount_type === 'fixed' &&
    (monthlyPrice.price_amount * 12 - yearlyPrice.price_amount) /
      (monthlyPrice.price_amount * 12)

  return (
    <div className="flex flex-col items-start gap-8 pb-8 md:flex-row md:gap-12 md:pb-0">
      <div className="flex flex-col gap-8 md:w-2/3">
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
      <div className="flex w-full flex-col gap-8 md:sticky md:top-16 md:w-1/3">
        <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
          <h3 className="text-lg font-medium">{product.name}</h3>
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
              <ProductPrices prices={product.prices} />
            </h1>
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Before VAT and taxes
            </p>
          </div>
          {product.benefits.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="font-medium dark:text-white">You get</h1>
              </div>
              <List size="small">
                {product.benefits.map((benefit) => (
                  <ListItem
                    key={benefit.id}
                    className="justify-start gap-x-4"
                    size="small"
                  >
                    {resolveBenefitIcon(benefit, 'small', 'h-5 w-5')}
                    <div className="flex flex-col">
                      <span className="text-sm">{benefit.description}</span>
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        {resolveBenefitTypeDisplayName(benefit.type)}
                      </span>
                    </div>
                  </ListItem>
                ))}
              </List>
            </div>
          ) : (
            <></>
          )}
          <div className="flex flex-col gap-4">
            {isRecurring ? (
              <>
                {monthlyPrice && (
                  <CheckoutButton
                    product={product}
                    recurringInterval="month"
                    organization={organization}
                    checkoutPath="/api/checkout"
                    variant="default"
                  >
                    {yearlyPrice && monthlyPrice.amount_type === 'fixed'
                      ? `Subscribe for ${formatCurrencyAndAmount(monthlyPrice.price_amount, monthlyPrice.price_currency, 0)} per month`
                      : 'Subscribe now'}
                  </CheckoutButton>
                )}
                {yearlyPrice && (
                  <div className="relative">
                    <CheckoutButton
                      product={product}
                      recurringInterval="year"
                      organization={organization}
                      checkoutPath="/api/checkout"
                      variant="default"
                    >
                      {monthlyPrice && yearlyPrice.amount_type === 'fixed'
                        ? `Subscribe for ${formatCurrencyAndAmount(yearlyPrice.price_amount, yearlyPrice.price_currency, 0)} per year`
                        : 'Subscribe now'}
                    </CheckoutButton>
                    {yearlyDiscount && yearlyDiscount > 0 && (
                      <div className="text-xxs absolute -right-1 -top-2 rounded-full bg-green-100 bg-gradient-to-l px-2 py-0.5 text-green-400 dark:bg-green-950 dark:text-green-300">
                        Save {percentageFormatter.format(yearlyDiscount)}
                      </div>
                    )}
                  </div>
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
