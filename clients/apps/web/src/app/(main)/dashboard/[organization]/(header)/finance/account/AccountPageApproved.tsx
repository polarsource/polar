'use client'

import IdentityStep from '@/components/Finance/Steps/IdentityStep'
import PayoutAccountStep from '@/components/Finance/Steps/PayoutAccountStep'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { useStartIdentityVerification } from '@/hooks/identityVerification'
import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { CheckIcon } from 'lucide-react'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageApproved = ({ organization }: Props) => {
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id || undefined,
  )
  const { start: startIdentityVerification, identityVerificationStatus } =
    useStartIdentityVerification()

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!">
      <div className="flex flex-col gap-y-12">
        <Section>
          <SectionDescription
            title="Account Review"
            description="Your submitted organization details and compliance status."
          />
          <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
            <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <CheckIcon className="dark:text-polar-400 h-4 w-4 text-gray-500" />
            </span>
            <h4 className="mb-2 font-medium">Account approved</h4>
            <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
              Your product and organization details have been reviewed and
              approved.
            </p>
          </div>
        </Section>

        <Section>
          <SectionDescription
            title="Payout Account"
            description="Set up your payout account to receive payouts."
          />
          <PayoutAccountStep
            organization={organization}
            payoutAccount={payoutAccount}
          />
        </Section>

        <Section>
          <SectionDescription
            title="Identity Verification"
            description="Verify your identity to comply with financial regulations."
          />
          <IdentityStep
            identityVerificationStatus={identityVerificationStatus}
            onStartIdentityVerification={startIdentityVerification}
          />
        </Section>
      </div>
    </DashboardBody>
  )
}
