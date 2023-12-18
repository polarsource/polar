'use client'

import { Product } from '@/components/Product/Product'
import { Slideshow } from '@/components/Product/Slideshow'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { StarRounded } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Avatar,
  Button,
  PolarTimeAgo,
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'

const ClientPage = ({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) => {
  const stars = useMemo(() => Math.random() * 4 + 1, [])

  return (
    <div className="flex w-full flex-col gap-y-8">
      <StaggerReveal className="flex flex-col gap-y-12">
        <StaggerReveal.Child>
          <Slideshow images={[product.image]} />
        </StaggerReveal.Child>
        <div className="flex flex-row gap-x-12">
          <StaggerReveal.Child className="w-2/3">
            <ShadowBoxOnMd className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm text-blue-500 dark:text-blue-400">
                  {product.type}
                </span>
                <Link
                  className="flex flex-row items-center gap-x-2"
                  href={`/${organization.name}`}
                >
                  <Avatar
                    className="h-8 w-8"
                    avatar_url={organization.avatar_url}
                    name={organization.name}
                  />
                </Link>
              </div>
              <h2 className="text-xl font-medium">{product.name}</h2>

              <p className="dark:text-polar-500 leading-relaxed text-gray-500">
                {product.description}
              </p>
              <Separator />
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-x-2">
                  <div className="flex flex-row items-center">
                    {Array(Math.floor(stars))
                      .fill(0)
                      .map((_, i) => (
                        <StarRounded
                          className="text-blue-500 dark:text-blue-400"
                          fontSize="small"
                          key={i}
                        />
                      ))}
                    {Array(5 - Math.floor(stars))
                      .fill(0)
                      .map((_, i) => (
                        <StarRounded
                          className="dark:text-polar-600 text-gray-400"
                          fontSize="small"
                          key={i}
                        />
                      ))}
                  </div>
                  <span>
                    {Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(stars)}
                  </span>
                </div>
                <span className="dark:text-polar-500 text-gray-500">
                  <PolarTimeAgo date={product.createdAt} />
                </span>
              </div>
            </ShadowBoxOnMd>
          </StaggerReveal.Child>
          <StaggerReveal.Child className="w-1/3">
            <ShadowBoxOnMd className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-4">
                <h3 className="text-4xl !font-light">
                  ${getCentsInDollarString(product.price, false, true)}
                </h3>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  VAT included (where applicable)
                </p>
              </div>
              <div className="flex flex-col items-center gap-y-4">
                <Button fullWidth>Buy Now</Button>
                <p className="dark:text-polar-500 text-center text-xs text-gray-500">
                  30-day money back guarantee
                </p>
              </div>
            </ShadowBoxOnMd>
          </StaggerReveal.Child>
        </div>
      </StaggerReveal>
    </div>
  )
}

export default ClientPage
