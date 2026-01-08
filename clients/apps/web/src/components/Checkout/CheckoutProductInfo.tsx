import { markdownOptions } from '@/utils/markdown'
import type { CheckoutOrganization } from '@polar-sh/sdk/models/components/checkoutorganization'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Markdown from 'markdown-to-jsx'
import { Slideshow } from '../Products/Slideshow'

interface CheckoutProductInfoProps {
  organization: CheckoutOrganization
  product: CheckoutProduct
  isLayoutTreatment?: boolean
}

const CheckoutProductInfo = ({
  organization,
  product,
  isLayoutTreatment = false,
}: CheckoutProductInfoProps) => {
  return (
    <div
      className={
        isLayoutTreatment
          ? 'contents md:flex md:flex-col md:gap-y-4'
          : 'contents'
      }
    >
      <div className="flex flex-col gap-y-6 md:gap-y-8">
        <Avatar
          className={
            isLayoutTreatment
              ? 'h-12 w-12 md:hidden'
              : 'h-12 w-12 md:h-16 md:w-16'
          }
          avatar_url={organization.avatarUrl}
          name={organization.name}
        />
        {product.name ? (
          <h1
            className={isLayoutTreatment ? 'text-3xl md:text-xl' : 'text-3xl'}
          >
            {product.name}
          </h1>
        ) : (
          <div className="dark:bg-polar-700 h-6 w-48 animate-pulse rounded-md bg-gray-200" />
        )}
      </div>
      {product.medias.length > 0 && (
        <Slideshow images={product.medias.map((m) => m.publicUrl)} />
      )}
      {product.description && (
        <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-medium prose-headings:text-black prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-md prose-h5:text-sm prose-h6:text-sm dark:prose-headings:text-white dark:text-polar-300 max-w-4xl leading-normal text-gray-800">
          <Markdown options={markdownOptions}>{product.description}</Markdown>
        </div>
      )}
    </div>
  )
}

export default CheckoutProductInfo
