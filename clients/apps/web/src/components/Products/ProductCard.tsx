'use client'

import { Product } from '@/hooks/queries/dummy_products'
import { getCentsInDollarString } from '@/utils/money'
import { PanoramaOutlined } from '@mui/icons-material'
import Markdown from 'markdown-to-jsx'
import Image from 'next/image'
import { Pill } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { markdownOpts } from '../Feed/Markdown/markdown'

interface ProductCardProps {
  product: Product
  showOrganization?: boolean
}

export const ProductCard = ({
  product,
  showOrganization = false,
}: ProductCardProps) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex h-full w-full flex-col gap-6 rounded-3xl border border-transparent bg-white p-6 shadow-sm transition-colors hover:bg-gray-50">
      {product.media.length > 0 ? (
        <Image
          className="aspect-square w-full rounded-2xl bg-gray-100 object-cover"
          alt={`${product.name} product image`}
          width={600}
          height={600}
          src={product.media[0]}
        />
      ) : (
        <div className="dark:bg-polar-900 flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-gray-100">
          <PanoramaOutlined className="dark:text-polar-500 text-gray-500" />
        </div>
      )}
      <div className="flex flex-grow flex-col gap-3">
        {showOrganization && (
          <div className="flex flex-row items-center gap-x-2">
            <Avatar
              className="h-4 w-4"
              avatar_url={product.organization.avatar_url}
              name={product.organization.name}
            />
            <span className="text-xs">
              {product.organization.pretty_name ?? product.organization.name}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-y-2">
          <h3 className="dark:text-polar-50 line-clamp-2 font-medium leading-snug text-gray-950">
            {product.name}
          </h3>
          <div className="dark:text-polar-400 line-clamp-2 text-sm text-gray-600">
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
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-lg leading-snug text-blue-500 dark:text-blue-400">
          ${getCentsInDollarString(product.price)}
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
