'use client'

import { useCustomerOrders } from '@/hooks/queries'
import { api } from '@/utils/client'
import { organizationPageLink } from '@/utils/nav'
import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

interface OrganizationStorefrontNavProps {
  className?: string
  organization: schemas['Organization']
}

export const StorefrontNav = ({
  organization,
  className,
}: OrganizationStorefrontNavProps) => {
  const routeSegment = useSelectedLayoutSegment()
  const currentTab = routeSegment ?? 'products'
  const router = useRouter()

  const { data: orders } = useCustomerOrders(api)

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
