import { Slideshow } from '@/components/Products/Slideshow'
import { markdownOptions } from '@/utils/markdown'
import { organizationPageLink } from '@/utils/nav'
import { CheckoutProduct, Organization } from '@polar-sh/api'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'

interface CheckoutProductInfoProps {
  organization: Organization
  product: CheckoutProduct
}

const CheckoutProductInfo = ({
  organization,
  product,
}: CheckoutProductInfoProps) => {
  return (
    <>
      <div className="flex flex-col gap-y-6 md:gap-y-8">
        {organization.profile_settings?.enabled ? (
          <Link href={organizationPageLink(organization)}>
            <Avatar
              className="h-12 w-12 md:h-16 md:w-16"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
          </Link>
        ) : (
          <Avatar
            className="h-12 w-12 md:h-16 md:w-16"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
        )}
        <h1 className="text-3xl">{product.name}</h1>
      </div>
      {product.medias.length > 0 && (
        <Slideshow
          images={product.medias.map(({ public_url }) => public_url)}
        />
      )}
      {product.description ? (
        <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-medium prose-headings:text-black prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-md prose-h5:text-sm prose-h6:text-sm dark:prose-headings:text-white dark:text-polar-300 max-w-4xl text-gray-800">
          <Markdown options={markdownOptions}>{product.description}</Markdown>
        </div>
      ) : (
        <></>
      )}
    </>
  )
}

export default CheckoutProductInfo
