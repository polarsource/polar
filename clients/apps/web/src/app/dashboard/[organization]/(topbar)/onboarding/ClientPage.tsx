'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CreatorUpsell } from '@/components/Onboarding/Creator/CreatorUpsell'
import React from 'react'

const OnboardingPage: React.FC = ({}) => {
  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-20">
      <CreatorUpsell />
    </DashboardBody>
  )
}

export default OnboardingPage
