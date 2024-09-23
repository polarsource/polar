import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import { Slideshow } from '@/components/Products/Slideshow'
import {
  useRecurringInterval,
  useRecurringProductPrice,
} from '@/hooks/products'
import { Organization, Product } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Input from 'polarkit/components/ui/atoms/input'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { resolveBenefitIcon } from '../Benefit/utils'
import LogoType from '../Brand/LogoType'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import SubscriptionTierRecurringIntervalSwitch from '../Subscriptions/SubscriptionTierRecurringIntervalSwitch'

export interface CheckoutProps {
  organization: Organization
  product: Product
}

export const Checkout = (props: CheckoutProps) => {
  return (
    <ShadowBox className="dark:border-polar-700 flex w-full max-w-7xl flex-row items-stretch divide-x border p-0">
      <ProductInfo {...props} />
      <CheckoutForm {...props} />
    </ShadowBox>
  )
}

interface ProductInfoProps {
  organization: Organization
  product: Product
}

const ProductInfo = ({ organization, product }: ProductInfoProps) => {
  const isRecurring = product.is_recurring

  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval([product])

  const recurringPrice = useRecurringProductPrice(product, recurringInterval)
  const oneTimePrice = product.prices.find((price) => price.type === 'one_time')
  const isFixedPrice = product.prices.every(
    (price) => price.amount_type === 'fixed',
  )

  return (
    <div className="flex w-1/2 flex-col gap-y-12 p-24">
      <Avatar
        className="md:h-16 md:w-16"
        avatar_url={organization.avatar_url}
        name={organization.name}
      />
      <h1 className="text-3xl">{product.name}</h1>
      {product.medias.length > 0 && (
        <Slideshow
          images={product.medias.map(({ public_url }) => public_url)}
        />
      )}
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
      )}{' '}
      <div className="flex w-full flex-col items-center gap-8">
        {hasBothIntervals && (
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        )}
        <ShadowBox className="dark:bg-polar-950 flex flex-col gap-8 bg-gray-100 md:ring-gray-100">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-light">
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
              <List size="small">
                {product.benefits.map((benefit) => (
                  <ListItem
                    key={benefit.id}
                    className="justify-start gap-x-3"
                    size="small"
                  >
                    {resolveBenefitIcon(benefit, 'small', 'h-4 w-4')}
                    <span className="text-sm">{benefit.description}</span>
                  </ListItem>
                ))}
              </List>
            </div>
          ) : (
            <></>
          )}
        </ShadowBox>
      </div>
    </div>
  )
}

interface CheckoutFormProps {}

export const CheckoutForm = ({ organization, product }: CheckoutFormProps) => {
  return (
    <div className="flex w-1/2 flex-col justify-between gap-y-24 p-24">
      <div className="flex flex-col gap-y-12">
        <h1 className="text-2xl">Checkout</h1>

        <div className="flex flex-col gap-y-8">
          <Input />
          <Input />
          <Input />
          <Input />
          <Input />
          <Input />
          <Input />
        </div>
        <p className="dark:text-polar-500 text-center text-xs text-gray-500">
          This order is processed by our online reseller & Merchant of Record,
          Polar, who also handles order-related inquiries and returns.
        </p>
      </div>
      <div className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </div>
  )
}
