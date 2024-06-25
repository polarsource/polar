'use client'

import { useOrganization } from '@/hooks/queries'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { BoltOutlined, DiamondOutlined } from '@mui/icons-material'
import { Product, ProductPrice } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import { Pill } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { markdownOpts } from '../Feed/Markdown/markdown'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'
import ProductPriceLabel from './ProductPriceLabel'
import ProductPrices from './ProductPrices'

interface ProductCardProps {
  product: Product
  price?: ProductPrice
  showOrganization?: boolean
}

export const ProductCard = ({
  product,
  price,
  showOrganization = false,
}: ProductCardProps) => {
  const { data: organization } = useOrganization(
    product.organization_id,
    showOrganization,
  )
  return (
    <div className="dark:border-polar-700 dark:hover:bg-polar-900 dark:from-polar-950 dark:to-polar-950 hover:bg-gray-75 flex h-full w-full flex-col gap-6 overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-tr from-white to-blue-50/50 transition-colors">
      {isFeatureEnabled('products') && (
        <>
          {product.medias.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="dark:bg-polar-950 aspect-square w-full bg-gray-100 object-cover"
              alt={product.medias[0].name}
              width={600}
              height={600}
              src={product.medias[0].public_url}
            />
          ) : (
            <div className="dark:border-polar-700 flex aspect-square w-full flex-col items-center justify-center border-b border-gray-200">
              <div className="dark:bg-polar-900 dark:border-polar-800 flex aspect-square w-24 flex-col items-center justify-center rounded-full bg-blue-50 text-4xl text-blue-500 dark:border dark:text-white">
                {product.is_recurring ? (
                  <BoltOutlined fontSize="inherit" />
                ) : (
                  <DiamondOutlined fontSize="inherit" />
                )}
              </div>
            </div>
          )}
        </>
      )}
      <div className="flex flex-grow flex-col gap-3 px-6">
        {organization && showOrganization && (
          <div className="flex flex-row items-center gap-x-2">
            <Avatar
              className="h-6 w-6"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <span className="text-xs">
              {organization.pretty_name ?? organization.name}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-y-2">
          <h3 className="line-clamp-2 flex items-center justify-between gap-1 font-medium leading-snug text-gray-950 dark:text-white">
            {product.name}
            <SubscriptionGroupIcon type={product.type} className="text-xl" />
          </h3>
          <div className="dark:text-polar-400 line-clamp-2 text-sm text-gray-600">
            {product.description && (
              <Markdown
                options={{
                  ...markdownOpts,
                  overrides: {
                    ...markdownOpts.overrides,
                    p: (args: any) => <>{args.children} </>, // Note the space
                    div: (args: any) => <>{args.children} </>, // Note the space
                    img: () => <></>,
                    a: (args: any) => <>{args.children}</>,
                    strong: (args: any) => <>{args.children}</>,
                    em: (args: any) => <>{args.children}</>,
                    defaultOverride: (args: any) => <>{args.children}</>,
                  },
                }}
              >
                {product.description.substring(0, 100)}
              </Markdown>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center justify-between px-6 pb-6">
        <h3 className="text-lg leading-snug text-blue-500 dark:text-blue-400">
          {price ? (
            <ProductPriceLabel price={price} />
          ) : (
            <ProductPrices prices={product.prices} />
          )}
        </h3>
        <Pill className="px-2.5 py-1" color="blue">
          {product.benefits.length === 1
            ? `${product.benefits.length} Benefit`
            : `${product.benefits.length} Benefits`}{' '}
        </Pill>
      </div>
    </div>
  )
}
