'use client'

import { organizationPageLink } from '@/utils/nav'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

interface OrganizationStorefrontNavProps {
  className?: string
  organization: Organization
}

export const StorefrontNav = ({
  organization,
  className,
}: OrganizationStorefrontNavProps) => {
  const routeSegment = useSelectedLayoutSegment()
  const currentTab = routeSegment ?? 'products'

  return (
    <Tabs value={currentTab}>
      <TabsList
        className={twMerge(
          'flex w-full flex-row overflow-x-auto bg-transparent ring-0 dark:bg-transparent dark:ring-0',
          className,
        )}
      >
        <Link href={organizationPageLink(organization)}>
          <TabsTrigger value="products">Products</TabsTrigger>
        </Link>

        {organization.feature_settings?.articles_enabled && (
          <Link href={organizationPageLink(organization, 'posts')}>
            <TabsTrigger value="posts">Newsletter</TabsTrigger>
          </Link>
        )}

        {organization.feature_settings?.issue_funding_enabled && (
          <Link href={organizationPageLink(organization, 'issues')}>
            <TabsTrigger value="issues">Issue Funding</TabsTrigger>
          </Link>
        )}

        {organization.donations_enabled && (
          <Link href={organizationPageLink(organization, 'donate')}>
            <TabsTrigger value="donate">Donate</TabsTrigger>
          </Link>
        )}

        <Link href={organizationPageLink(organization, 'portal')}>
          <TabsTrigger value="portal">Customer Portal</TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  )
}
