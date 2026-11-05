'use client'

import { OverviewQuickActions } from '@/components/DashboardOverview/OverviewQuickActions'
import { OverviewSection } from '@/components/DashboardOverview/OverviewSection'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { PlanUpsell } from '@/components/Upsell/PlanUpsell'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { ActivityWidget } from '@/components/Widgets/ActivityWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { CustomerRiskWidget } from '@/components/Widgets/CustomerRiskWidget'
import { GrossMarginWidget } from '@/components/Widgets/GrossMarginWidget'
import { TopCustomersWidget } from '@/components/Widgets/TopCustomersWidget'
import { schemas } from '@polar-sh/client'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'
import { DisputesBanner } from './DisputesBanner'
import { OrganizationStatusBanner } from './OrganizationStatusBanner'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

const WidgetRow = ({ children }: PropsWithChildren) => (
  <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
    <div className="-mr-px -mb-px grid grid-cols-1 lg:grid-cols-3">
      {children}
    </div>
  </div>
)

const OverviewTitle = ({
  organization,
}: {
  organization: schemas['Organization']
}) => (
  <Box flexDirection="column" rowGap="2xl" flexGrow={1}>
    <Box alignItems="center" justifyContent="between" columnGap="m">
      <Box alignItems="center" columnGap="m" minWidth={0}>
        <Avatar
          className="h-8 w-8"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <Text variant="body">{organization.name}</Text>
      </Box>
      <OverviewQuickActions organization={organization} />
    </Box>
    <Text as="h1" variant="heading-xs" weight="medium">
      Overview
    </Text>
  </Box>
)

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  return (
    <DashboardBody
      className="gap-y-8 md:gap-y-16"
      title={<OverviewTitle organization={organization} />}
    >
      <PlanUpsell organization={organization} />
      <OrganizationStatusBanner organization={organization} />
      <DisputesBanner organization={organization} />
      <div className="flex flex-col gap-y-10">
        <WidgetRow>
          <RevenueWidget className={cellClassName} />
          <ActivityWidget className={cellClassName} />
          <AccountWidget className={cellClassName} />
        </WidgetRow>
        <WidgetRow>
          <TopCustomersWidget className={cellClassName} />
          <CustomerRiskWidget className={cellClassName} />
          <GrossMarginWidget className={cellClassName} />
        </WidgetRow>
      </div>

      <OverviewSection organization={organization} />
    </DashboardBody>
  )
}
