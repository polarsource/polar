import EmailLink from '../components/text/EmailLink'
import Footer from '../components/layout/Footer'
import InfoBox from '../components/InfoBox'
import Intro from '../components/text/Intro'
import List from '../components/List'
import ListItem from '../components/ListItem'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
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
      <InfoBox title="What This Means" variant="info">
        <List>
          <ListItem>
            <Text as="span" weight="bold">
              {organization_kept_name}
            </Text>{' '}
            keeps the existing Stripe payout account with no changes required on
            your end.
          </ListItem>
          <ListItem>
            The following organizations require you to connect a new Stripe
            payout account:
            <List>
              {organizations_unlinked.map((org: string) => (
                <ListItem key={org}>
                  <Text as="span" weight="bold">
                    {org}
                  </Text>{' '}
                  at{' '}
                  <EmailLink
                    href={`https://polar.com/dashboard/${org}/finance/account`}
                  >
                    https://polar.com/dashboard/{org}/finance/account
                  </EmailLink>
                </ListItem>
              ))}
            </List>
          </ListItem>
        </List>
      </InfoBox>
      <InfoBox title="Important Information" variant="warning">
        <List>
          <ListItem>
            <Text as="span" weight="bold">
              Payments:
            </Text>{' '}
            This update does not affect your ability to receive payments -
            customers can continue making payments as usual.
          </ListItem>
          <ListItem>
            <Text as="span" weight="bold">
              Withdrawals:
            </Text>{' '}
            Withdrawals can be resumed as soon as the new Stripe payout account
            is connected.
          </ListItem>
          <ListItem>
            <Text as="span" weight="bold">
              Payout history:
            </Text>{' '}
            All payout history is still available on{' '}
            <Text as="span" weight="bold">
              {organization_kept_name}
            </Text>{' '}
            organization.
          </ListItem>
        </List>
      </InfoBox>
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
