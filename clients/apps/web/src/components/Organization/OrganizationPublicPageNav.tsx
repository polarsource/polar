'use client'

import { organizationPageLink } from '@/utils/nav'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegment,
} from 'next/navigation'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Tabs } from 'polarkit/components/ui/tabs'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrganizationPublicPageNavProps {
  className?: string
  organization: Organization
  mobileLayout?: boolean
}

export const OrganizationPublicPageNav = ({
  organization,
  className,
  mobileLayout = false,
}: OrganizationPublicPageNavProps) => {
  const router = useRouter()
  const pathname = usePathname()

  const routeSegment = useSelectedLayoutSegment()
  const currentTab = routeSegment ?? 'overview'

  const handleSelectChange = useCallback(
    (value: string) => {
      const path = value === 'overview' ? '' : value
      router.push(`/${organization.name}/${path}`)
    },
    [organization, router],
  )

  const isPostsView = pathname.includes('/posts/')

  const tabsTriggerClassName =
    'data-[state=active]:rounded-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-500 dark:data-[state=active]:bg-blue-950 hover:text-blue-500 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none'

  if (mobileLayout) {
    return (
      <div className="flex w-full flex-row items-center justify-stretch gap-x-2">
        {isPostsView ? (
          <Link
            className="flex flex-shrink-0"
            href={`/${organization.name}/posts`}
          >
            <Button
              size="sm"
              variant="secondary"
              className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
            >
              <ArrowBackOutlined fontSize="inherit" />
            </Button>
          </Link>
        ) : null}
        <Select value={currentTab} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Go to page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Overview</SelectItem>
            <SelectItem value="posts">Posts</SelectItem>
            <SelectItem value="subscriptions">Subscriptions</SelectItem>
            <SelectItem value="issues">Issues</SelectItem>
            <SelectItem value="repositories">Repositories</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <Tabs value={currentTab}>
      <TabsList
        className={twMerge(
          'flex w-full flex-row overflow-x-auto bg-transparent ring-0 dark:bg-transparent dark:ring-0',
          className,
        )}
      >
        <Link href={organizationPageLink(organization)}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="overview"
            size="small"
          >
            Overview
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'posts')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="posts"
            size="small"
          >
            Posts
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'subscriptions')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="subscriptions"
            size="small"
          >
            Subscriptions
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'issues')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="issues"
            size="small"
          >
            Issues
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'repositories')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="repositories"
            size="small"
          >
            Repositories
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  )
}
