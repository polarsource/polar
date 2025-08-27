import { useOrganizationAccount } from '@/hooks/queries'
import { ACCOUNT_TYPE_DISPLAY_NAMES, ACCOUNT_TYPE_ICON } from '@/utils/account'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import Link from 'next/link'
import Icon from '../Icons/Icon'

const GenericAccountBanner: React.FC<{
  account: schemas['Account'] | undefined
  organization: schemas['Organization'] | undefined
  setupLink: string
}> = ({ account, organization, setupLink }) => {
  const isActive =
    organization?.status === 'active' && account?.stripe_id !== null
  const isUnderReview = organization?.status === 'under_review'

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
            You need to set up a <strong>payout account</strong> to receive
            payouts
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
        <span className="text-sm">Your payout account is under review</span>
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
          account to receive payouts
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
              {accountType !== 'manual' && (
                <Link href={setupLink}>
                  <Button size="sm">Manage</Button>
                </Link>
              )}
            </>
          }
        >
          <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
          <span className="dark:text-polar-400 text-sm">
            {accountType === 'stripe' &&
              'Payouts will be made to the connected Stripe account'}
            {accountType === 'open_collective' &&
              'Payouts will be made in bulk once per month to the connected Open Collective account'}
            {accountType === 'manual' &&
              'Payouts will be made manually via bank transfers. Reach out to support@polar.sh to follow-up.'}
          </span>
        </Banner>
      </>
    )
  }

  return null
}

const OrganizationAccountBanner: React.FC<{
  organization: schemas['Organization']
}> = ({ organization }) => {
  const { data: organizationAccount, isLoading: organizationAccountIsLoading } =
    useOrganizationAccount(organization?.id)
  const setupLink = `/dashboard/${organization.slug}/finance/account`

  if (organizationAccountIsLoading) {
    return null
  }

  return (
    <GenericAccountBanner
      account={organizationAccount}
      organization={organization}
      setupLink={setupLink}
    />
  )
}

interface AccountBannerProps {
  organization: schemas['Organization']
}

const AccountBanner: React.FC<AccountBannerProps> = ({ organization }) => {
  return (
    <>
      <OrganizationAccountBanner organization={organization} />
    </>
  )
}

export default AccountBanner
