import { Link, Section, Text } from 'react-email'

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
      <Section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Text className="m-0 text-[16px] font-bold text-blue-900">
          What This Means
        </Text>
        <ul className="ml-4 list-disc p-0 text-[14px] text-blue-900">
          <li>
            <span className="font-bold">{organization_kept_name}</span> keeps
            the existing Stripe payout account with no changes required on your
            end.
          </li>
          <li className="mt-2">
            The following organizations require you to connect a new Stripe
            payout account:
            <ul className="ml-4 list-disc p-0">
              {organizations_unlinked.map((org: string) => (
                <li key={org} className="mt-2">
                  <span className="font-bold">{org}</span> at{' '}
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
      <Section className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <Text className="m-0 text-[16px] font-bold text-yellow-900">
          Important Information
        </Text>
        <ul className="ml-4 list-disc p-0 text-[14px] text-yellow-900">
          <li>
            <span className="font-bold">Payments:</span> This update does not
            affect your ability to receive payments - customers can continue
            making payments as usual.
          </li>
          <li className="mt-2">
            <span className="font-bold">Withdrawals:</span> Withdrawals can be
            resumed as soon as the new Stripe payout account is connected.
          </li>
          <li className="mt-2">
            <span className="font-bold">Payout history:</span> All payout
            history is still available on{' '}
            <span className="font-bold">{organization_kept_name}</span>{' '}
            organization.
          </li>
        </ul>
      </Section>
    </>
  )
}

export default AccountUnlinkDetails
