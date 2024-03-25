import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { AccountType, Organization, Status, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { ACCOUNT_TYPE_DISPLAY_NAMES, ACCOUNT_TYPE_ICON } from 'polarkit/account'
import Button from 'polarkit/components/ui/atoms/button'
import { Banner } from 'polarkit/components/ui/molecules'
import { useAccount } from 'polarkit/hooks'
import Icon from '../Icons/Icon'

interface AccountBannerProps {
  organization: Organization
  user?: UserRead
  isPersonal?: boolean
}

const AccountBanner: React.FC<AccountBannerProps> = ({
  organization,
  user,
  isPersonal,
}) => {
  const { data: organizationAccount } = useAccount(organization.account_id)
  const { data: personalAccount } = useAccount(user?.account_id)

  const setupLink = isPersonal
    ? '/finance/account'
    : `/maintainer/${organization.name}/finance/account`

  const currentAccount = isPersonal
    ? organizationAccount || personalAccount
    : organizationAccount
  const bothOrganizationAndPersonal =
    isPersonal &&
    organizationAccount !== undefined &&
    personalAccount !== undefined &&
    organizationAccount.id !== personalAccount.id
  const isActive = currentAccount?.status === Status.ACTIVE
  const isUnderReview = currentAccount?.status === Status.UNDER_REVIEW

  if (!currentAccount) {
    return (
      <>
        <Banner
          color="default"
          right={
            <Link href={setupLink}>
              <Button size="sm">Setup</Button>
            </Link>
          }
        >
          <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
          <span className="text-sm">
            You need to set up <strong>Stripe</strong> or{' '}
            <strong>Open Collective</strong> to receive transfers
          </span>
        </Banner>
      </>
    )
  }

  if (bothOrganizationAndPersonal) {
    return (
      <>
        <Banner
          color="default"
          right={
            <Link href={setupLink}>
              <Button size="sm">Fix</Button>
            </Link>
          }
        >
          <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
          <span className="text-sm">
            You have two payout accounts selected, both as a backer and
            maintainer.
          </span>
        </Banner>
      </>
    )
  }

  if (currentAccount && isUnderReview) {
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[currentAccount.account_type]
    return (
      <Banner
        color="default"
        right={
          <Link href={setupLink}>
            <Button size="sm">Read more</Button>
          </Link>
        }
      >
        <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
        <span className="text-sm">
          Your{' '}
          <strong>
            {ACCOUNT_TYPE_DISPLAY_NAMES[currentAccount.account_type]}
          </strong>{' '}
          account is under review
        </span>
      </Banner>
    )
  }

  if (currentAccount && !isActive && !isUnderReview) {
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[currentAccount.account_type]
    return (
      <Banner
        color="default"
        right={
          <Link href={setupLink}>
            <Button size="sm">Continue setup</Button>
          </Link>
        }
      >
        <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
        <span className="text-sm">
          Continue the setup of your{' '}
          <strong>
            {ACCOUNT_TYPE_DISPLAY_NAMES[currentAccount.account_type]}
          </strong>{' '}
          account to receive transfers
        </span>
      </Banner>
    )
  }

  if (currentAccount && isActive) {
    const accountType = currentAccount.account_type
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[accountType]
    return (
      <>
        <Banner
          color="muted"
          right={
            <>
              <Link href={setupLink}>
                <Button size="sm">Manage</Button>
              </Link>
            </>
          }
        >
          <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
          <span className="dark:text-polar-400 text-sm">
            {accountType === AccountType.STRIPE &&
              'Payouts will be made to the connected Stripe account'}
            {accountType === AccountType.OPEN_COLLECTIVE &&
              'Payouts will be made in bulk once per month to the connected Open Collective account'}
          </span>
        </Banner>
      </>
    )
  }

  return null
}

export default AccountBanner
