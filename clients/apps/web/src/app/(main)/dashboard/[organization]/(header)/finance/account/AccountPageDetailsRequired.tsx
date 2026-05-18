'use client'

import { InfoCard } from '@/components/Finance/Account/InfoCard'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequired = ({ organization }: Props) => {
  const isDenied = organization.status === 'denied'

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

        {!isDenied && (
          <>
            <Section>
              <SectionDescription
                title="Payout Account"
                description="Set up your payout account to receive payouts."
              />
              <InfoCard>Please go through account review first</InfoCard>
            </Section>

            <Section>
              <SectionDescription
                title="Identity Verification"
                description="Verify your identity to comply with financial regulations."
              />
              <InfoCard>Please go through account review first</InfoCard>
            </Section>
          </>
        )}
      </div>
    </DashboardBody>
  )
}
