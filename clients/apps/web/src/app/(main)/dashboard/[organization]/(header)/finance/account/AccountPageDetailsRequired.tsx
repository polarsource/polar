'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequired = ({ organization }: Props) => {
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!">
      <div className="flex flex-col gap-y-12">
        <Section>
          <SectionDescription
            title="Account Review"
            description="Tell us about your organization so we can review your usecase."
          />
          <OrganizationProfileSettings organization={organization} kyc={true} />
        </Section>
      </div>
    </DashboardBody>
  )
}
