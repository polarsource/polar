import { Link, Preview, Section, Text } from '@react-email/components'
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
        We'd like to inform you that some of your Stripe payout accounts associated with organizations in Polar have been detached. This update was made as part of our ongoing efforts to enhance security and ensure compliance, as sharing the same Stripe account across multiple organizations will no longer be permitted going forward.
      </IntroWithHi>
      <Section>
        <BodyText>
          Your organization{' '}
          <span className="font-bold">{organization_kept_name}</span> has
          retained the connected Stripe payout account, and{' '}
          <span className="font-bold">no data has been lost</span>.
        </BodyText>
      </Section>
      <Section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Text className="m-0 text-[16px] font-bold text-blue-900">
          What This Means
        </Text>
        <ul className="p-0 ml-4 list-disc text-[14px] text-blue-900">
          <li className="">
            <span className="font-bold">{organization_kept_name}</span> keeps
            the existing Stripe payout account with no changes required on your end.
          </li>
          <li className="mt-2">
            The following organizations require you to connect a new Stripe payout account:
            <ul className="p-0 ml-4 list-disc">
              {organizations_unlinked.map((org: string) => (
                <li key={org} className="mt-2">
                  <span className="font-bold">{org}</span> at <Link href={`https://polar.com/dashboard/${org}/finance/account`}>https://polar.com/dashboard/{org}/finance/account</Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Section>
      <Section className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <Text className="m-0 text-[16px] font-bold text-yellow-900">
          Important Information
        </Text>
        <ul className="p-0 ml-4 list-disc text-[14px] text-yellow-900">
          <li className="">
            <span className="font-bold">Payments:</span> This update does not affect your ability to receive payments - customers can continue making payments as usual.
          </li>
          <li className="mt-2">
            <span className="font-bold">Withdrawals:</span> Withdrawals can be resumed as soon as the new Stripe payout account is connected.
          </li>
          <li className="mt-2">
            <span className="font-bold">Payout history:</span> All payout
            history is still available on{' '}
            <span className="font-bold">{organization_kept_name}</span> organization.
          </li>
        </ul>
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
