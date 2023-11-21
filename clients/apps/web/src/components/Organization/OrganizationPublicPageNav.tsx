'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  Bolt,
  DragIndicatorOutlined,
  HiveOutlined,
  HowToVoteOutlined,
} from '@mui/icons-material'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import ProfileSelection from '../Shared/ProfileSelection'

interface OrganizationPublicPageNavProps {
  shouldRenderSubscriptionsTab: boolean
}

export const OrganizationPublicPageNav = ({
  shouldRenderSubscriptionsTab,
}: OrganizationPublicPageNavProps) => {
  const router = useRouter()

  const search = useSearchParams()
  const pathname = usePathname()

  const handleTabChange = useCallback(
    (value: string) => () => {
      const params = new URLSearchParams(search)
      params.set('tab', value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [search, pathname],
  )

  return (
    <div className="flex w-full flex-row items-center md:grow-0 md:justify-between">
      <TabsList className="dark:border-polar-700 hidden dark:border md:flex">
        <TabsTrigger
          value="overview"
          size="small"
          onClick={handleTabChange('overview')}
        >
          <div className="text-[18px]">
            <DragIndicatorOutlined fontSize="inherit" />
          </div>
          <span>Overview</span>
        </TabsTrigger>
        {isFeatureEnabled('feed') && (
          <TabsTrigger
            value="issues"
            size="small"
            onClick={handleTabChange('issues')}
          >
            <div className="text-[18px]">
              <HowToVoteOutlined fontSize="inherit" />
            </div>
            <span>Issues</span>
          </TabsTrigger>
        )}
        <TabsTrigger
          value="repositories"
          size="small"
          onClick={handleTabChange('repositories')}
        >
          <div className="text-[18px]">
            <HiveOutlined fontSize="inherit" />
          </div>
          <span>Repositories</span>
        </TabsTrigger>
        {isFeatureEnabled('subscriptions') && shouldRenderSubscriptionsTab && (
          <TabsTrigger
            value="subscriptions"
            size="small"
            onClick={handleTabChange('subscriptions')}
          >
            <div className="text-[18px]">
              <Bolt fontSize="inherit" />
            </div>
            <span>Subscriptions</span>
          </TabsTrigger>
        )}
      </TabsList>
      <div className="z-50 w-full md:w-[280px]">
        <ProfileSelection
          narrow
          showBackerLinks
          useOrgFromURL={false}
          className="border border-gray-100 shadow-sm"
        />
      </div>
    </div>
  )
}
