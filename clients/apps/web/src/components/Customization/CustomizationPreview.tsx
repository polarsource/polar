import {
  useListArticles,
  useListOrganizations,
  useOrganizationCustomers,
  useProducts,
  useSearchDonations,
  useSearchFunding,
} from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  ArticleVisibility,
  Organization,
  OrganizationCustomerType,
} from '@polar-sh/sdk'
import React from 'react'
import { OrganizationPublicSidebar } from '../Organization/OrganizationPublicSidebar'
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

  const subscriberSettings = organization.profile_settings?.subscribe ?? {
    show_count: true,
    count_free: true,
  }

  const customers = useOrganizationCustomers({
    id: organization.id,
    customerTypes: new Set(
      subscriberSettings.count_free
        ? [
            OrganizationCustomerType.PAID_SUBSCRIPTION,
            OrganizationCustomerType.FREE_SUBSCRIPTION,
          ]
        : [OrganizationCustomerType.PAID_SUBSCRIPTION],
    ),
    limit: 3,
  })

  const userOrganizations = useListOrganizations({ isMember: true })

  return (
    <div className="flex w-full flex-grow flex-row gap-x-24 px-12 md:space-y-12">
      <div className="relative flex w-fit flex-shrink-0 flex-col justify-between py-8 md:sticky md:top-0 md:py-16">
        <OrganizationPublicSidebar
          organizationCustomers={
            subscriberSettings.show_count ? customers.data : undefined
          }
          organization={organization}
          userOrganizations={userOrganizations.data?.items ?? []}
          products={products}
        />
      </div>
      <div className="flex h-full flex-grow flex-col gap-y-8 md:gap-y-16 md:py-12">
        <PublicPage
          organization={organization}
          posts={posts}
          products={products}
          issues={issues}
          donations={donations}
        />
      </div>
    </div>
  )
}

export const CustomizationPreview = () => {
  const { organization } = React.useContext(MaintainerOrganizationContext)

  return <PublicPagePreview organization={organization} />
}
