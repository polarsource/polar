import AccountUnlinkDetails from '../components/AccountUnlinkDetails'
import { Footer, WrapperPolar } from '../components/layout'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function OrganizationAccountUnlink({
  email,
  organization_kept_name,
  organizations_unlinked,
}: schemas['OrganizationAccountUnlinkProps']) {
  return (
    <WrapperPolar
      preview={`Important: Organization Account Update for ${organization_kept_name}`}
    >
      <Intro>
        We'd like to inform you that some of your Stripe payout accounts
        associated with organizations in Polar have been detached. This update
        was made as part of our ongoing efforts to enhance security and ensure
        compliance, as sharing the same Stripe account across multiple
        organizations will no longer be permitted going forward.
      </Intro>
      <Text>
        Your organization{' '}
        <Text as="span" weight="bold">
          {organization_kept_name}
        </Text>{' '}
        has retained the connected Stripe payout account, and{' '}
        <Text as="span" weight="bold">
          no data has been lost
        </Text>
        .
      </Text>
      <AccountUnlinkDetails
        organization_kept_name={organization_kept_name}
        organizations_unlinked={organizations_unlinked}
      />
      <Text>
        If you have any questions or concerns, please don't hesitate to reach
        out to our support team.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

OrganizationAccountUnlink.PreviewProps = {
  email: 'admin@example.com',
  organization_kept_name: 'Acme Inc.',
  organizations_unlinked: ['Beta Corp', 'Gamma LLC'],
}

export default OrganizationAccountUnlink
