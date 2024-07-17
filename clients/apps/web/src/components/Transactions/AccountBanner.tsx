import { useAccount, useOrganizationAccount } from '@/hooks/queries'
import { ACCOUNT_TYPE_DISPLAY_NAMES, ACCOUNT_TYPE_ICON } from '@/utils/account'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import {
  Account,
  AccountType,
  Organization,
  Status,
  UserRead,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Banner } from 'polarkit/components/ui/molecules'
import Icon from '../Icons/Icon'

const GenericAccountBanner: React.FC<{
  account: Account | undefined
  setupLink: string
}> = ({ account, setupLink }) => {
  const isActive = account?.status === Status.ACTIVE
  const isUnderReview = account?.status === Status.UNDER_REVIEW

  if (!account) {
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

  if (account && isUnderReview) {
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[account.account_type]
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
          <strong>{ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}</strong>{' '}
          account is under review
        </span>
      </Banner>
    )
  }

  if (account && !isActive && !isUnderReview) {
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[account.account_type]
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
          <strong>{ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}</strong>{' '}
          account to receive transfers
        </span>
      </Banner>
    )
  }

  if (account && isActive) {
    const accountType = account.account_type
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

const UserAccountBanner: React.FC<{ user: UserRead }> = ({ user }) => {
  const { data: account, isLoading: personalAccountIsLoading } = useAccount(
    user?.account_id,
  )
  const setupLink = '/finance/account'

  if (personalAccountIsLoading) {
    return null
  }

  return <GenericAccountBanner account={account} setupLink={setupLink} />
}

const OrganizationAccountBanner: React.FC<{ organization: Organization }> = ({
  organization,
}) => {
  const { data: account, isLoading: organizationAccountIsLoading } =
    useOrganizationAccount(organization?.id)
  const setupLink = `/maintainer/${organization.slug}/finance/account`

  if (organizationAccountIsLoading) {
    return null
  }

  return <GenericAccountBanner account={account} setupLink={setupLink} />
}

interface AccountBannerProps {
  organization?: Organization
  user?: UserRead
}

const AccountBanner: React.FC<AccountBannerProps> = ({
  organization,
  user,
}) => {
  return (
    <>
      {organization && (
        <OrganizationAccountBanner organization={organization} />
      )}
      {user && <UserAccountBanner user={user} />}
    </>
  )
}

export default AccountBanner
