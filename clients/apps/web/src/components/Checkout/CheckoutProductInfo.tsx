'use client'

import { markdownOptions } from '@/utils/markdown'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutOrganization } from '@polar-sh/sdk/models/components/checkoutorganization'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@polar-sh/ui/components/ui/dialog'
import Markdown from 'markdown-to-jsx'
import { useEffect, useRef, useState } from 'react'
import { Slideshow } from '../Products/Slideshow'

const ExpandableDescription = ({
  description,
  locale = DEFAULT_LOCALE,
}: {
  description: string
  productName: string
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale)
  const textRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (!el) return

    // Check after browser has painted the markdown content
    requestAnimationFrame(() => {
      setIsClamped(el.scrollHeight > el.clientHeight)
    })
  }, [description])

  return (
    <div className="flex flex-col gap-y-1">
      <div
        ref={textRef}
        className={`prose dark:prose-invert prose-headings:mt-2 prose-headings:font-medium prose-headings:text-black prose-h1:text-sm prose-h2:text-sm prose-h3:text-sm dark:prose-headings:text-white dark:text-polar-400 max-w-none text-sm leading-normal text-gray-500 ${!isExpanded ? 'line-clamp-2' : ''}`}
      >
        <Markdown options={markdownOptions}>{description}</Markdown>
      </div>
      {isClamped && (
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="dark:text-polar-300 cursor-pointer self-start text-xs text-gray-600 hover:underline"
        >
          {isExpanded
            ? t('checkout.productDescription.readLess')
            : t('checkout.productDescription.readMore')}
        </button>
      )}
    </div>
  )
}

interface CheckoutProductInfoProps {
  organization: CheckoutOrganization
  product: CheckoutProduct
  locale?: AcceptedLocale
}

const CheckoutProductInfo = ({ product, locale }: CheckoutProductInfoProps) => {
  const firstImage = product.medias[0]?.publicUrl
  const additionalImages = product.medias.slice(1)

  return (
    <div className="contents">
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-start gap-x-4">
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
            {product.name ? (
              <h1 className="text-2xl font-medium">{product.name}</h1>
            ) : (
              <div className="dark:bg-polar-700 h-6 w-48 animate-pulse rounded-md bg-gray-200" />
            )}
            {product.description && (
              <ExpandableDescription
                description={product.description}
                productName={product.name}
                locale={locale}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutProductInfo
