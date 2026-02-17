'use client'

import { markdownOptions } from '@/utils/markdown'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import type { CheckoutOrganization } from '@polar-sh/sdk/models/components/checkoutorganization'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@polar-sh/ui/components/ui/dialog'
import Markdown from 'markdown-to-jsx'
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
  const isTreatment = pricingPositionExperiment === 'treatment'
  const firstImage = product.medias[0]?.publicUrl
  const additionalImages = product.medias.slice(1)

  if (isTreatment) {
    return (
      <div className="contents">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center gap-x-4">
            {firstImage && (
              <Dialog>
                <DialogTrigger asChild disabled={additionalImages.length === 0}>
                  <button
                    className={`relative h-[70px] w-[70px] flex-shrink-0 ${additionalImages.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <img
                      src={firstImage}
                      alt={product.name}
                      className="h-[70px] w-[70px] rounded-lg object-cover"
                    />
                    {additionalImages.length > 0 && (
                      <span className="absolute right-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                        +{additionalImages.length}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="dark:bg-polar-900 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{product.name}</DialogTitle>
                    <DialogDescription className="sr-only">
                      Product images
                    </DialogDescription>
                  </DialogHeader>
                  <Slideshow images={product.medias.map((m) => m.publicUrl)} />
                </DialogContent>
              </Dialog>
            )}
            <div className="flex flex-col gap-y-1">
              <div className="flex flex-row items-center gap-x-2">
                {product.name ? (
                  <h1 className="text-2xl font-medium">{product.name}</h1>
                ) : (
                  <div className="dark:bg-polar-700 h-6 w-48 animate-pulse rounded-md bg-gray-200" />
                )}
                {product.description && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="dark:text-polar-500 dark:hover:text-polar-300 cursor-pointer text-gray-400 hover:text-gray-600">
                        <InfoOutlined className="h-5 w-5" fontSize="inherit" />
                      </button>
                    </DialogTrigger>
                    <DialogContent
                      className="dark:bg-polar-900 max-h-[80vh] overflow-y-auto"
                      style={
                        {
                          '--tw-enter-translate-x': '0',
                          '--tw-enter-translate-y': '0',
                          '--tw-exit-translate-x': '0',
                          '--tw-exit-translate-y': '0',
                        } as React.CSSProperties
                      }
                    >
                      <DialogHeader>
                        <DialogTitle>{product.name}</DialogTitle>
                        <DialogDescription className="sr-only">
                          Product description
                        </DialogDescription>
                      </DialogHeader>
                      <div className="prose dark:prose-invert prose-headings:mt-4 prose-headings:font-medium prose-headings:text-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-md dark:prose-headings:text-white dark:text-polar-300 leading-normal text-gray-800">
                        <Markdown options={markdownOptions}>
                          {product.description}
                        </Markdown>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>
        </div>
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
