'use client'

import { markdownOptions } from '@/utils/markdown'
import type { CheckoutOrganization } from '@polar-sh/sdk/models/components/checkoutorganization'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Markdown from 'markdown-to-jsx'
import { useState } from 'react'
import { Slideshow } from '../Products/Slideshow'

interface CheckoutProductInfoProps {
  organization: CheckoutOrganization
  product: CheckoutProduct
  pricingPositionExperiment?: 'treatment' | 'control'
}

const CheckoutProductInfo = ({
  organization,
  product,
  pricingPositionExperiment,
}: CheckoutProductInfoProps) => {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const isTreatment = pricingPositionExperiment === 'treatment'
  const firstImage = product.medias[0]?.publicUrl
  const remainingImages = product.medias.slice(1).map((m) => m.publicUrl)

  if (isTreatment) {
    return (
      <div className="contents">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center gap-x-4">
            {firstImage && (
              <img
                src={firstImage}
                alt={product.name}
                className="h-[70px] w-[70px] rounded-lg object-cover"
              />
            )}
            <div className="flex flex-col gap-y-1">
              {product.name ? (
                <h1 className="text-2xl font-medium">{product.name}</h1>
              ) : (
                <div className="dark:bg-polar-700 h-6 w-48 animate-pulse rounded-md bg-gray-200" />
              )}
              {product.description && (
                <p
                  className="dark:text-polar-400 line-clamp-2 cursor-pointer text-xs text-gray-500"
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                >
                  {product.description}
                </p>
              )}
            </div>
          </div>
          {remainingImages.length > 0 && (
            <Slideshow images={remainingImages} />
          )}
        </div>
        {descriptionExpanded && product.description && (
          <div
            className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-medium prose-headings:text-black prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-md prose-h5:text-sm prose-h6:text-sm dark:prose-headings:text-white dark:text-polar-300 max-w-4xl cursor-pointer leading-normal text-gray-800"
            onClick={() => setDescriptionExpanded(false)}
          >
            <Markdown options={markdownOptions}>{product.description}</Markdown>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="contents">
      <div className="flex flex-col gap-y-6 md:gap-y-8">
        <Avatar
          className="h-12 w-12 md:h-16 md:w-16"
          avatar_url={organization.avatarUrl}
          name={organization.name}
        />
        {product.name ? (
          <h1 className="text-3xl">{product.name}</h1>
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
