'use client'

import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { useAuth } from '@/hooks'
import { useListArticles, useProducts, useSearchFunding } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  ArticleVisibility,
  Organization,
  OrganizationUpdate,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { useFormContext } from 'react-hook-form'
import { Storefront } from '../../Profile/Storefront'
import { StorefrontHeader } from '../../Profile/StorefrontHeader'

export const StorefrontPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)
  const { watch } = useFormContext<OrganizationUpdate>()
  const { currentUser } = useAuth()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate }

  const posts =
    useListArticles({
      organizationId: organization.id,
      isPublished: true,
      visibility: ArticleVisibility.PUBLIC,
      limit: 4,
    }).data?.pages[0].items ?? []

  const products =
    useProducts(organization.id, { isArchived: false }).data?.items ?? []

  const issues =
    useSearchFunding({
      organizationId: org.id,
      limit: 10,
      page: 1,
      closed: false,
      sort: [
        'most_funded',
        'most_recently_funded',
        'most_engagement',
        'newest',
      ],
    }).data?.items ?? []

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="flex w-full max-w-7xl flex-col gap-y-12">
        <div className="relative flex flex-row items-center justify-end gap-x-6">
          <BrandingMenu
            className="absolute left-1/2 -translate-x-1/2"
            size={50}
          />

          <TopbarRight authenticatedUser={currentUser} />
        </div>
        {!organization.profile_settings?.enabled && (
          <div className="flex flex-row items-center justify-center rounded-full bg-red-100 px-8 py-2 text-sm text-red-500 dark:bg-red-950">
            Storefront is not enabled
          </div>
        )}
        <div className="flex flex-grow flex-col items-center">
          <StorefrontHeader organization={organization as Organization} />
        </div>
        <div className="flex h-full flex-grow flex-col gap-y-8 pb-16 md:gap-y-16">
          <Storefront
            organization={organization as Organization}
            posts={posts}
            products={products}
            issues={issues}
          />
        </div>
      </div>
    </ShadowBox>
  )
}
