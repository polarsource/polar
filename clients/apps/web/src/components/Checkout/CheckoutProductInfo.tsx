import { markdownOptions } from '@/utils/markdown'
import { organizationPageLink } from '@/utils/nav'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { Organization } from '@polar-sh/sdk/models/components/organization'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Markdown from 'markdown-to-jsx'
import Image from 'next/image'
import Link from 'next/link'

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
        {organization.profileSettings?.enabled ? (
          <Link href={organizationPageLink(organization)}>
            <Avatar
              className="h-12 w-12 md:h-16 md:w-16"
              avatar_url={organization.avatarUrl}
              name={organization.name}
            />
          </Link>
        ) : (
          <Avatar
            className="h-12 w-12 md:h-16 md:w-16"
            avatar_url={organization.avatarUrl}
            name={organization.name}
          />
        )}
        <h1 className="text-3xl">{product.name}</h1>
      </div>
      {product.medias.length > 0 && (
        <div className="dark:bg-polar-900 dark:border-polar-700 relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100 bg-cover bg-center lg:rounded-3xl dark:border">
          <Image
            alt={product.medias[0].name}
            src={product.medias[0].publicUrl}
            layout="fill"
            objectFit="cover"
          />
        </div>
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
