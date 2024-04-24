'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import { previewOpts } from '@/components/Feed/Markdown/BrowserRender'
import { Product } from '@/hooks/queries/products'
import { getCentsInDollarString } from '@/utils/money'
import { Organization } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Image from 'next/image'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'

export default function ClientPage({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) {
  return (
    <div className="flex flex-row items-start gap-12">
      <div className="flex w-2/3 flex-col gap-8">
        {product.media && (
          <Image
            className="aspect-video rounded-3xl border border-gray-100 object-cover"
            width={1280}
            height={720}
            alt={`${product.name} product image`}
            src={product.media}
          />
        )}
        <ShadowBoxOnMd className="flex flex-col gap-6 md:ring-gray-100">
          <h1 className="text-2xl font-medium">{product.name}</h1>
          <div className="flex flex-row items-center gap-2 self-start rounded-full bg-blue-50 p-1 pr-4">
            <Avatar
              className="h-6 w-6"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <span className="text-sm text-blue-500">{organization.name}</span>
          </div>
          <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-white max-w-4xl text-gray-800">
            <Markdown
              options={{
                ...previewOpts,
                overrides: {
                  ...previewOpts.overrides,
                  a: (props) => (
                    <a {...props} rel="noopener noreferrer nofollow" />
                  ),
                },
              }}
            >
              {product.description}
            </Markdown>
          </div>
        </ShadowBoxOnMd>
      </div>
      <div className="flex w-1/3 flex-col gap-8">
        <ShadowBoxOnMd className="flex flex-col gap-8 md:ring-gray-100">
          <h3 className="font-medium">{product.name}</h3>
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
              ${getCentsInDollarString(product.price)}
            </h1>
            <p className="dark:text-polar-600 text-sm text-gray-400">
              Including VAT and taxes
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth>
              Buy Now
            </Button>
            <Button size="lg" variant="ghost" fullWidth>
              Add to Wishlist
            </Button>
          </div>
        </ShadowBoxOnMd>
        <ShadowBoxOnMd className="flex flex-col gap-6 md:ring-gray-100">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-medium">Included</h1>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              This product will grant you the following benefits
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {product.benefits.map((benefit) => (
              <div
                key={benefit.id}
                className="dark:bg-polar-700 flex flex-row items-center gap-3 rounded-2xl bg-gray-100 p-4"
              >
                {resolveBenefitIcon(benefit, 'small', 'h-5 w-5')}
                <span className="text-sm">{benefit.description}</span>
              </div>
            ))}
          </div>
        </ShadowBoxOnMd>
      </div>
    </div>
  )
}
