'use client'

import { useProducts } from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

interface OrganizationPublicPageNavProps {
  className?: string
  organization: Organization
}

export const OrganizationPublicPageNav = ({
  organization,
  className,
}: OrganizationPublicPageNavProps) => {
  const routeSegment = useSelectedLayoutSegment()
  const currentTab = routeSegment ?? 'overview'

  const { data: products } = useProducts(organization.id, {
    isRecurring: false,
  })
  const renderProductsTab = (products?.items?.length ?? 0) > 0

  return (
    <Tabs value={currentTab}>
      <TabsList
        className={twMerge(
          'flex w-full flex-row overflow-x-auto bg-transparent ring-0 dark:bg-transparent dark:ring-0',
          className,
        )}
      >
        <Link href={organizationPageLink(organization)}>
          <TabsTrigger value="overview" size="small">
            Overview
          </TabsTrigger>
        </Link>

        {organization.feature_settings?.subscriptions_enabled && (
          <Link href={organizationPageLink(organization, 'subscriptions')}>
            <TabsTrigger value="subscriptions" size="small">
              Subscriptions
            </TabsTrigger>
          </Link>
        )}

        {renderProductsTab && (
          <Link href={organizationPageLink(organization, 'products')}>
            <TabsTrigger value="products" size="small">
              Products
            </TabsTrigger>
          </Link>
        )}

        {organization.feature_settings?.articles_enabled && (
          <Link href={organizationPageLink(organization, 'posts')}>
            <TabsTrigger value="posts" size="small">
              Newsletter
            </TabsTrigger>
          </Link>
        )}

        {organization.feature_settings?.issue_funding_enabled && (
          <Link href={organizationPageLink(organization, 'issues')}>
            <TabsTrigger value="issues" size="small">
              Issues
            </TabsTrigger>
          </Link>
        )}

        {organization.has_app_installed && (
          <Link href={organizationPageLink(organization, 'repositories')}>
            <TabsTrigger value="repositories" size="small">
              Repositories
            </TabsTrigger>
          </Link>
        )}
      </TabsList>
    </Tabs>
  )
}
