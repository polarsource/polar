'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CreatorUpsell } from '@/components/Onboarding/Creator/CreatorUpsell'
import { NewsFromPolar } from '@/components/Onboarding/Creator/NewsFromPolar'
import { PostWizard } from '@/components/Onboarding/Creator/PostWizard'
import { SetupSubscriptions } from '@/components/Onboarding/Creator/SetupSubscriptions'
import { Organization } from '@polar-sh/sdk'
import React from 'react'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

const OverviewPage: React.FC<OverviewPageProps> = ({}) => {
  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-20">
      <CreatorUpsell />
      <PostWizard />
      <SetupSubscriptions />
      <NewsFromPolar />
    </DashboardBody>
  )
}

export default OverviewPage
