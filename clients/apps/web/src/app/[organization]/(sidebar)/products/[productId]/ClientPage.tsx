'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import { previewOpts } from '@/components/Feed/Markdown/BrowserRender'
import { Slideshow } from '@/components/Products/Slideshow'
import { Product } from '@/hooks/queries/products'
import { getCentsInDollarString } from '@/utils/money'
import { Organization } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export default function ClientPage({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) {
  return (
    <div className="flex flex-col items-start gap-8 pb-8 md:flex-row md:gap-12 md:pb-0">
      <div className="flex flex-col gap-8 md:w-2/3">
        {product.media.length && <Slideshow images={product.media} />}
        <ShadowBox className="flex flex-col gap-6 ring-gray-100">
          <h1 className="text-2xl font-medium">{product.name}</h1>
          <div className="flex flex-row items-center gap-2 self-start rounded-full bg-blue-50 p-1 pr-4 dark:bg-blue-950">
            <Avatar
              className="h-6 w-6"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <span className="text-sm text-blue-500 dark:text-blue-200">
              {organization.name}
            </span>
          </div>
          <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
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
        </ShadowBox>
      </div>
      <div className="flex w-full flex-col gap-8 md:sticky md:top-16 md:w-1/3">
        <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
          <h3 className="font-medium">{product.name}</h3>
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
              ${getCentsInDollarString(product.price)}
            </h1>
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Before VAT and taxes
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="dark:text-polar-50 font-medium">You get</h1>
            </div>
            <div className="flex flex-col gap-2">
              {product.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-center gap-3 text-blue-500 dark:text-blue-400"
                >
                  {resolveBenefitIcon(benefit, 'small', 'h-5 w-5')}
                  <span className="text-sm">{benefit.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth>
              Buy Now
            </Button>
          </div>
        </ShadowBox>
      </div>
    </div>
  )
}
