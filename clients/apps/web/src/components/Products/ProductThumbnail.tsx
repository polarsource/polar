import { TextureOutlined } from '@mui/icons-material'
import { Product } from '@polar-sh/api'
import { twMerge } from 'tailwind-merge'

export const ProductThumbnail = ({
  size = 'small',
  product,
}: {
  size?: 'small' | 'medium'
  product: Product
}) => {
  let coverUrl = null
  if (product.medias.length > 0) {
    coverUrl = product.medias[0].public_url
  }

  const sizeClassName = size === 'small' ? 'h-10' : 'h-24'

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex aspect-square h-10 flex-col items-center justify-center border border-transparent bg-gray-100 text-center',
        sizeClassName,
      )}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={product.name}
          className={twMerge('aspect-square h-10 object-cover', sizeClassName)}
        />
      ) : (
        <TextureOutlined
          fontSize="medium"
          className="dark:text-polar-600 text-gray-300"
        />
      )}
    </div>
  )
}
