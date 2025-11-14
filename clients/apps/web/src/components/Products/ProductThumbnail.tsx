import TextureOutlined from '@mui/icons-material/TextureOutlined'
import { schemas } from '@polar-sh/client'
import { twMerge } from 'tailwind-merge'

export const ProductThumbnail = ({
  size = 'small',
  product,
}: {
  size?: 'small' | 'medium'
  product: schemas['Product'] | schemas['CheckoutProduct']
}) => {
  let coverUrl = null
  if (product.medias.length > 0) {
    coverUrl = product.medias[0].public_url
  }

  const sizeClassName = size === 'small' ? 'h-10 rounded-md' : 'h-24 rounded-xl'

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 hidden aspect-square h-10 shrink-0 grow-0 flex-col items-center justify-center border border-transparent bg-gray-100 text-center md:flex',
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
