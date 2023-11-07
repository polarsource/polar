'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  Bolt,
  DragIndicatorOutlined,
  HiveOutlined,
  LandscapeOutlined,
} from '@mui/icons-material'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'

export const OrganizationPublicPageNav = () => {
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
    <TabsList className="dark:border-polar-700 dark:border">
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
      {isFeatureEnabled('subscriptions') && (
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
      {isFeatureEnabled('subscriptions') && (
        <TabsTrigger
          value="campaigns"
          size="small"
          onClick={handleTabChange('campaigns')}
        >
          <div className="text-[18px]">
            <LandscapeOutlined fontSize="inherit" />
          </div>
          <span>Campaigns</span>
        </TabsTrigger>
      )}
    </TabsList>
  )
}
