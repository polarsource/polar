'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AIValidationResult from '@/components/Organization/AIValidationResult'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageInReview = ({ organization }: Props) => {
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
