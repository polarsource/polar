'use client'

import { Product, resolveProductTypeIcon } from '@/components/Benefit/Benefit'
import { Slideshow } from '@/components/Benefit/Slideshow'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { ArrowBackOutlined, StarRounded } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar, Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
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
  const TypeIcon = resolveProductTypeIcon(product.type)

  return (
    <div className="flex w-full flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-x-2 text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/${organization.name}/benefits`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Benefits</span>
      </Link>
      <StaggerReveal className="flex flex-col gap-y-8">
        <StaggerReveal.Child>
          <Slideshow images={[product.image]} />
        </StaggerReveal.Child>
        <div className="flex flex-row gap-x-8">
          <StaggerReveal.Child className="w-2/3">
            <ShadowBoxOnMd className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center justify-between">
                <span className="flex flex-row items-center gap-x-2 text-sm font-medium text-blue-500 dark:text-blue-400">
                  <TypeIcon fontSize="small" />
                  {product.type}
                </span>
                <div className="flex flex-row items-center gap-x-2">
                  <div className="flex flex-row items-center">
                    {Array(Math.floor(stars))
                      .fill(0)
                      .map((_, i) => (
                        <StarRounded
                          className="text-blue-500 dark:text-blue-400"
                          fontSize="inherit"
                          key={i}
                        />
                      ))}
                    {Array(5 - Math.floor(stars))
                      .fill(0)
                      .map((_, i) => (
                        <StarRounded
                          className="dark:text-polar-600 text-gray-300"
                          fontSize="inherit"
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
              </div>
              <h2 className="text-xl font-medium">{product.name}</h2>

              <p className="dark:text-polar-500 whitespace-break-spaces leading-relaxed text-gray-500">
                {product.description}
              </p>
            </ShadowBoxOnMd>
          </StaggerReveal.Child>
          <StaggerReveal.Child className="w-1/3">
            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <div className="flex flex-col gap-y-4">
                <Link
                  className="flex flex-row items-center gap-x-2"
                  href={`/${organization.name}`}
                >
                  <Avatar
                    className="h-10 w-10"
                    avatar_url={organization.avatar_url}
                    name={organization.name}
                  />
                </Link>
                <span>{product.name}</span>
              </div>
              <div className="flex flex-col gap-y-6">
                <div className="flex flex-col gap-y-4">
                  <h3 className="text-5xl !font-light">
                    ${getCentsInDollarString(product.price, false, true)}
                  </h3>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    VAT included (where applicable)
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-y-6">
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
