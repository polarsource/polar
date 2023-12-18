import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { ArrowForward, BoltOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { getCentsInDollarString } from 'polarkit/money'
import { useRef } from 'react'
import { useHoverDirty } from 'react-use'
import { AnimatedIconButton } from '../Feed/Posts/Post'
import { Product } from './Product'

export interface ProductTileProps {
  product: Product
}

export const ProductTile = ({ product }: ProductTileProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const { org } = useCurrentOrgAndRepoFromURL()
  const isHovered = useHoverDirty(ref)

  return (
    <Link
      ref={ref}
      href={`/maintainer/${org?.name}/products/${product.slug}`}
      className="dark:bg-polar-900 dark:border-polar-700 dark:hover:bg-polar-800 flex h-full flex-col gap-y-6 rounded-3xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
    >
      <div
        className="aspect-square flex-shrink-0 rounded-2xl bg-cover bg-center"
        style={{ backgroundImage: `url(${product.image})` }}
      />
      <div className="flex h-full flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between">
          <p className="text-sm text-blue-500 dark:text-blue-400">
            {product.type}
          </p>
        </div>
        <div className="flex flex-row items-center justify-between">
          <h2 className="dark:text-polar-50 truncate text-lg font-medium text-gray-950">
            {product.name}
          </h2>
          <h3 className="dark:text-polar-50 flex-grow text-right text-lg text-gray-950">
            ${getCentsInDollarString(product.price, false, true)}
          </h3>
        </div>
        <p className="dark:text-polar-500 line-clamp-3 h-full text-sm text-gray-500">
          {product.description}
        </p>
        <div className="flex flex-row-reverse items-center justify-between gap-x-4">
          <AnimatedIconButton active={isHovered} variant="secondary">
            <ArrowForward fontSize="inherit" />
          </AnimatedIconButton>
          {product.unlockable && (
            <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
              <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
                <BoltOutlined fontSize="inherit" />
              </span>
              <span>Unlockable</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
