'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AIValidationResult from '@/components/Organization/AIValidationResult'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import { useEffect } from 'react'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageInReview = ({ organization }: Props) => {
  const posthog = usePostHog()

  useEffect(() => {
    posthog.capture('dashboard:organizations:account_review:view', {
      organization_id: organization.id,
    })
  }, [organization.id, posthog])

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!">
      <div className="flex flex-col gap-y-12">
        <Section>
          <SectionDescription
            title="Account Review"
            description="Your submitted organization details and compliance status."
          />
          <AIValidationResult organization={organization} />
        </Section>
      </div>
    </DashboardBody>
  )
}
