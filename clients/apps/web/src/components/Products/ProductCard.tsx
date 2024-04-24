import { Product } from '@/hooks/queries/products'
import { getCentsInDollarString } from '@/utils/money'
import { PanoramaOutlined } from '@mui/icons-material'
import Image from 'next/image'
import { Pill } from 'polarkit/components/ui/atoms'

interface ProductCardProps {
  product: Product
}

export const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex h-full w-full flex-col gap-6 rounded-3xl border border-transparent bg-white p-6 shadow-sm transition-colors hover:bg-gray-50">
      {product.media ? (
        <Image
          className="aspect-square w-full rounded-2xl bg-gray-100 object-cover"
          alt={`${product.name} product image`}
          width={400}
          height={400}
          src={product.media ?? ''}
        />
      ) : (
        <div className="dark:bg-polar-900 flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-gray-100">
          <PanoramaOutlined className="dark:text-polar-500 text-gray-500" />
        </div>
      )}
      <div className="flex flex-grow flex-col gap-2">
        <h3 className="dark:text-polar-50 line-clamp-2 font-medium leading-snug text-gray-950">
          {product.name}
        </h3>
        <p className="dark:text-polar-400 line-clamp-2 text-sm text-gray-600">
          {product.description}
        </p>
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
