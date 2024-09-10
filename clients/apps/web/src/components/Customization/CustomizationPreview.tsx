import {
  useListArticles,
  useProducts,
  useSearchDonations,
  useSearchFunding,
} from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ArticleVisibility, Organization } from '@polar-sh/sdk'
import React from 'react'
import { PublicPage } from '../Profile/ProfilePage'

interface PublicPagePreviewProps {
  organization: Organization
}

const PublicPagePreview = ({ organization }: PublicPagePreviewProps) => {
  const donations =
    useSearchDonations({
      toOrganizationId: organization.id,
      limit: 5,
      page: 0,
    }).data?.items ?? []

  const posts =
    useListArticles({
      organizationId: organization.id,
      isPublished: true,
      visibility: ArticleVisibility.PUBLIC,
      limit: 3,
    }).data?.pages[0].items ?? []

  const products =
    useProducts(organization.id, { isArchived: false }).data?.items ?? []

  const issues =
    useSearchFunding({
      organizationId: organization.id,
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
    <PublicPage
      organization={organization}
      posts={posts}
      products={products}
      issues={issues}
      donations={donations}
    />
  )
}

export const CustomizationPreview = () => {
  const { organization } = React.useContext(MaintainerOrganizationContext)

  return <PublicPagePreview organization={organization} />
}
