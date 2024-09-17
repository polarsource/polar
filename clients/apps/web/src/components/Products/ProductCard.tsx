'use client'

import { useOrganization } from '@/hooks/queries'
import { Product, ProductPrice } from '@polar-sh/sdk'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import LogoIcon from '../Brand/LogoIcon'
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
    <div className="flex h-full w-full flex-col gap-4 transition-opacity hover:opacity-50">
      {product.medias.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="dark:bg-polar-950 aspect-video w-full rounded-3xl bg-gray-100 object-cover"
          alt={product.medias[0].name}
          width={600}
          height={600}
          src={product.medias[0].public_url}
        />
      ) : (
        <div className="dark:from-polar-900 dark:via-polar-800 dark:to-polar-900 flex aspect-video w-full flex-col items-center justify-center rounded-3xl bg-gradient-to-tr from-white via-blue-50 to-white">
          <div className="flex flex-col items-center justify-center text-4xl text-blue-500 dark:text-white">
            <LogoIcon className="dark:text-polar-600 h-12 w-12 text-white/50" />
          </div>
        </div>
      )}
      <div className="flex flex-grow flex-col gap-y-2">
        <h3 className="line-clamp-1 flex items-center justify-between gap-1 leading-snug text-gray-950 dark:text-white">
          {product.name}
          {product.type && (
            <SubscriptionGroupIcon type={product.type} className="text-xl" />
          )}
        </h3>
        <div className="flex flex-row items-center justify-between ">
          {organization && showOrganization && (
            <div className="flex flex-row items-center gap-x-2">
              <Avatar
                className="h-6 w-6"
                avatar_url={organization.avatar_url}
                name={organization.name}
              />
              <span className="text-xs">{organization.name}</span>
            </div>
          )}

          <span className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-sm text-gray-500">
            <h3 className="leading-snug">
              {price ? (
                <ProductPriceLabel price={price} />
              ) : (
                <ProductPrices prices={product.prices} />
              )}
            </h3>
            {product.benefits.length > 0 && (
              <>
                ·
                <span>
                  {product.benefits.length === 1
                    ? `${product.benefits.length} Benefit`
                    : `${product.benefits.length} Benefits`}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
