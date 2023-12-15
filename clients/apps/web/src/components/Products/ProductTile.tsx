import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { BoltOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { Product } from './Product'

export interface ProductTileProps {
  product: Product
}

export const ProductTile = ({ product }: ProductTileProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  return (
    <Link
      href={`/maintainer/${org?.name}/products/inventory/${product.id}`}
      className="dark:bg-polar-900 dark:border-polar-700 dark:hover:bg-polar-800 flex flex-col gap-y-6 rounded-3xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
    >
      <div
        className="aspect-square rounded-2xl bg-cover bg-center"
        style={{ backgroundImage: `url(${product.image})` }}
      />
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between">
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {product.type}
          </p>
          {product.unlockable && (
            <div className="flex flex-row items-center justify-between gap-x-1 rounded-full bg-blue-50 px-2 py-0.5 text-[12px] text-blue-500 dark:bg-blue-950 dark:text-blue-400">
              <span className="flex flex-row items-center text-sm">
                <BoltOutlined fontSize="inherit" />
              </span>
              <span>Unlockable</span>
            </div>
          )}
        </div>
        <div className="flex flex-row items-center justify-between">
          <h2 className="dark:text-polar-50 text-lg font-medium text-gray-950">
            {product.name}
          </h2>
          <h3 className="dark:text-polar-50 text-lg text-gray-950">
            ${product.price}
          </h3>
        </div>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {product.description}
        </p>
      </div>
    </Link>
  )
}
