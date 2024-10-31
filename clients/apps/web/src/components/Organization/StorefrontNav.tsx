'use client'

import { useUserOrders } from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
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
  const router = useRouter()

  const { data: orders } = useUserOrders({
    organizationId: organization.id,
  })

  return (
    <>
      <Tabs className="w-full md:w-fit" value={currentTab}>
        <TabsList
          className={twMerge(
            'hidden w-full flex-row overflow-x-auto bg-transparent ring-0 sm:flex dark:bg-transparent dark:ring-0',
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

          {(orders?.items.length ?? 0) > 0 && (
            <Link href={organizationPageLink(organization, 'portal')}>
              <TabsTrigger value="portal">My Orders</TabsTrigger>
            </Link>
          )}
        </TabsList>
      </Tabs>

      <Select
        onValueChange={(value) => {
          const link = {
            products: organizationPageLink(organization),
            posts: organizationPageLink(organization, 'posts'),
            issues: organizationPageLink(organization, 'issues'),
            donate: organizationPageLink(organization, 'donate'),
            portal: organizationPageLink(organization, 'portal'),
          }[value]
          if (link) router.push(link)
        }}
        value={currentTab}
      >
        <SelectTrigger className="sm:hidden">
          <SelectValue placeholder="Select a section" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="products">
            <span className="whitespace-nowrap">Products</span>
          </SelectItem>
          {organization.feature_settings?.articles_enabled && (
            <SelectItem value="posts">
              <span className="whitespace-nowrap">Newsletter</span>
            </SelectItem>
          )}
          {organization.feature_settings?.issue_funding_enabled && (
            <SelectItem value="issues">
              <span className="whitespace-nowrap">Issue Funding</span>
            </SelectItem>
          )}
          {organization.donations_enabled && (
            <SelectItem value="donate">
              <span className="whitespace-nowrap">Donate</span>
            </SelectItem>
          )}
          {(orders?.items.length ?? 0) > 0 && (
            <SelectItem value="portal">
              <span className="whitespace-nowrap">My Orders</span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </>
  )
}
