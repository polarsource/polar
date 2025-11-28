import { useOrganizationAccount } from '@/hooks/queries'
import { ACCOUNT_TYPE_DISPLAY_NAMES, ACCOUNT_TYPE_ICON } from '@/utils/account'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import { CircleAlertIcon } from 'lucide-react'
import Link from 'next/link'
import Icon from '../Icons/Icon'

const GenericAccountBanner: React.FC<{
  account: schemas['Account'] | undefined
  setupLink: string
}> = ({ account, setupLink }) => {
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
          <CircleAlertIcon className="h-6 w-6 text-red-500" />
          <span className="text-sm">
            You need to set up a <strong>payout account</strong> to receive
            payouts
          </span>
        </Banner>
      </>
    )
  }

  if (account && account.status === 'onboarding_started') {
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
        <Icon classes="bg-blue p-1" icon={<AccountTypeIcon />} />
        <span className="text-sm">
          Continue the setup of your{' '}
          <strong>{ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}</strong>{' '}
          account to receive payouts
        </span>
      </Banner>
    )
  }

  return null
}

interface AccountBannerProps {
  organization: schemas['Organization']
}

const AccountBanner: React.FC<AccountBannerProps> = ({ organization }) => {
  const {
    data: organizationAccount,
    isLoading: organizationAccountIsLoading,
    error: accountError,
  } = useOrganizationAccount(organization?.id)
  const setupLink = `/dashboard/${organization.slug}/finance/account`

  if (organizationAccountIsLoading) {
    return null
  }

  const isNotAdmin =
    accountError && (accountError as any)?.response?.status === 403

  if (isNotAdmin) {
    return null
  }

  return (
    <GenericAccountBanner account={organizationAccount} setupLink={setupLink} />
  )
}

export default AccountBanner
