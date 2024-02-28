'use client'

import { organizationPageLink } from '@/utils/nav'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { useCallback, useMemo } from 'react'
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
  const currentTab = useMemo(() => {
    const pathParts = pathname.split('/')

    // Example: "/zegl/subscriptions"
    // 0: ""
    // 1: "zegl"
    // 2: "subscriptions"

    if (pathParts.length <= 2) {
      return 'overview'
    }
    if (pathParts.length >= 3 && pathParts[2] === 'posts') {
      return 'posts'
    }
    if (pathParts.length >= 3 && pathParts[2] === 'subscriptions') {
      return 'subscriptions'
    }
    if (pathParts.length >= 3 && pathParts[2] === 'issues') {
      return 'issues'
    }
    if (pathParts.length >= 3 && pathParts[2] === 'repositories') {
      return 'repositories'
    }

    // Fallback to repositories ("/zegl/reponame")
    return 'repositories'
  }, [pathname])

  const handleSelectChange = useCallback(
    (value: string) => {
      const path = value === 'overview' ? '' : value
      router.push(`/${organization.name}/${path}`)
    },
    [organization, router],
  )

  const isPostsView = pathname.includes('/posts/')

  const tabsTriggerClassName =
    'data-[state=active]:text-blue-500 hover:text-blue-500 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none p-0 data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent text-md'

  return mobileLayout ? (
    <>
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
    </>
  ) : (
    <Tabs value={currentTab}>
      <TabsList
        vertical
        className={twMerge(
          'flex flex-col bg-transparent p-0 ring-0 dark:bg-transparent dark:ring-0',
          className,
        )}
      >
        <Link href={organizationPageLink(organization)}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="overview"
            size="small"
          >
            {currentTab === 'overview' && <span>—</span>}
            <span>Overview</span>
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'posts')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="posts"
            size="small"
          >
            {currentTab === 'posts' && <span>—</span>}
            <span>Posts</span>
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'subscriptions')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="subscriptions"
            size="small"
          >
            {currentTab === 'subscriptions' && <span>—</span>}
            <span>Subscriptions</span>
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'issues')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="issues"
            size="small"
          >
            {currentTab === 'issues' && <span>—</span>}
            <span>Issues</span>
          </TabsTrigger>
        </Link>

        <Link href={organizationPageLink(organization, 'repositories')}>
          <TabsTrigger
            className={tabsTriggerClassName}
            value="repositories"
            size="small"
          >
            {currentTab === 'repositories' && <span>—</span>}
            <span>Repositories</span>
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  )
}
