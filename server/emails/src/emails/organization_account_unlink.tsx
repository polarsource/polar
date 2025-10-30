import { Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function OrganizationAccountUnlink({
  email,
  organization_kept_name,
  organizations_unlinked,
}: schemas['OrganizationAccountUnlinkProps']) {
  return (
    <Wrapper>
      <Preview>
        Important: Organization Account Update for {organization_kept_name}
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        We're writing to inform that we needed to unlink some of your
        organizations from Stripe. The problem is that multiple organizations
        shared the same Stripe account, and for security and compliance reasons
        we had to unlink them.
      </IntroWithHi>
      <Section>
        <BodyText>
          Your organization{' '}
          <span className="font-bold">{organization_kept_name}</span> has
          retained the connected account, and{' '}
          <span className="font-bold">no data has been lost</span>.
        </BodyText>
      </Section>
      <Section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Text className="mb-2 text-[16px] font-bold text-blue-900">
          What This Means
        </Text>
        <ul className="ml-4 list-disc text-[14px] text-blue-900">
          <li className="mb-2">
            <span className="font-bold">{organization_kept_name}</span> keeps
            the existing account setup with no changes required.
          </li>
          <li className="mb-2">
            The following organizations will need to complete the Stripe setup
            again:
            <ul className="ml-4 mt-2 list-disc">
              {organizations_unlinked.map((org) => (
                <li key={org} className="mb-1">
                  {org}
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Section>
      <Section className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <Text className="mb-2 text-[16px] font-bold text-yellow-900">
          Important Information
        </Text>
        <ul className="ml-4 list-disc text-[14px] text-yellow-900">
          <li className="mb-2">
            <span className="font-bold">Payments:</span> Not blocked - customers
            can continue making payments
          </li>
          <li className="mb-2">
            <span className="font-bold">Withdrawals:</span> Blocked until Stripe
            setup is completed for the affected organizations
          </li>
          <li className="mb-2">
            <span className="font-bold">Payout history:</span> All payout
            history is still available on{' '}
            <span className="font-bold">{organization_kept_name}</span>.
          </li>
        </ul>
      </Section>
      <Section>
        <BodyText>
          To restore full functionality for the organizations that need Stripe
          setup, please visit your organization settings and complete the Stripe
          connection process.
        </BodyText>
      </Section>
      <Section>
        <BodyText>
          If you have any questions or concerns, please don't hesitate to reach
          out to our support team.
        </BodyText>
      </Section>
      <Footer email={email} />
    </Wrapper>
  )
}

OrganizationAccountUnlink.PreviewProps = {
  email: 'admin@example.com',
  organization_kept_name: 'Acme Inc.',
  organizations_unlinked: ['Beta Corp', 'Gamma LLC'],
}

export default OrganizationAccountUnlink
