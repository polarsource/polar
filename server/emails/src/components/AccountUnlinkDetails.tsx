import { Link, Section } from 'react-email'
import { Text } from './foundation'

interface AccountUnlinkDetailsProps {
  organization_kept_name: string
  organizations_unlinked: string[]
}

export function AccountUnlinkDetails({
  organization_kept_name,
  organizations_unlinked,
}: AccountUnlinkDetailsProps) {
  return (
    <>
      <Section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <Text weight="bold" noMargin>
          What This Means
        </Text>
        <ul className="ml-4 list-disc p-0 text-[14px]">
          <li>
            <Text as="span" weight="bold">
              {organization_kept_name}
            </Text>{' '}
            keeps the existing Stripe payout account with no changes required on
            your end.
          </li>
          <li className="mt-2">
            The following organizations require you to connect a new Stripe
            payout account:
            <ul className="ml-4 list-disc p-0">
              {organizations_unlinked.map((org: string) => (
                <li key={org} className="mt-2">
                  <Text as="span" weight="bold">
                    {org}
                  </Text>{' '}
                  at{' '}
                  <Link
                    href={`https://polar.com/dashboard/${org}/finance/account`}
                  >
                    https://polar.com/dashboard/{org}/finance/account
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Section>
      <Section className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
        <Text weight="bold" noMargin>
          Important Information
        </Text>
        <ul className="ml-4 list-disc p-0 text-[14px]">
          <li>
            <Text as="span" weight="bold">
              Payments:
            </Text>{' '}
            This update does not affect your ability to receive payments -
            customers can continue making payments as usual.
          </li>
          <li className="mt-2">
            <Text as="span" weight="bold">
              Withdrawals:
            </Text>{' '}
            Withdrawals can be resumed as soon as the new Stripe payout account
            is connected.
          </li>
          <li className="mt-2">
            <Text as="span" weight="bold">
              Payout history:
            </Text>{' '}
            All payout history is still available on{' '}
            <Text as="span" weight="bold">
              {organization_kept_name}
            </Text>{' '}
            organization.
          </li>
        </ul>
      </Section>
    </>
  )
}

export default AccountUnlinkDetails
