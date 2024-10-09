import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import { Slideshow } from '@/components/Products/Slideshow'
import { organizationPageLink } from '@/utils/nav'
import {
  CheckoutPublic,
  CheckoutUpdatePublic,
  Organization,
} from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { CheckoutCard } from './CheckoutCard'

export interface CheckoutInfoProps {
  organization: Organization
  checkout: CheckoutPublic
  onCheckoutUpdate?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
}

export const CheckoutInfo = ({
  organization,
  checkout,
  onCheckoutUpdate,
}: CheckoutInfoProps) => {
  const { product } = checkout
  return (
    <div className="flex flex-col gap-y-12 md:w-1/2 md:p-20">
      <Link href={organizationPageLink(organization)}>
        <Avatar
          className="md:h-16 md:w-16"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
      </Link>
      <h1 className="text-3xl">{product.name}</h1>
      {product.medias.length > 0 && (
        <Slideshow
          images={product.medias.map(({ public_url }) => public_url)}
        />
      )}
      {product.description ? (
        <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-medium prose-headings:text-black prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-md prose-h5:text-sm prose-h6:text-sm dark:prose-headings:text-white dark:text-polar-300 max-w-4xl text-gray-800">
          <Markdown
            options={{
              ...markdownOpts,
              overrides: {
                ...markdownOpts.overrides,
                a: (props) => (
                  <a {...props} rel="noopener noreferrer nofollow" />
                ),
              },
            }}
          >
            {product.description}
          </Markdown>
        </div>
      ) : (
        <></>
      )}
      <CheckoutCard checkout={checkout} onCheckoutUpdate={onCheckoutUpdate} />
    </div>
  )
}
