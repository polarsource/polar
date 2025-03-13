'use client'

import AccountAssociations from '@/components/Accounts/AccountAssociations'
import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'

interface AccoutSetupProps {
  organization: schemas['Organization'] | undefined
  organizationAccount: schemas['Account'] | undefined
  personalAccount?: schemas['Account']
  loading: boolean
  onLinkAccount: (accountId: string) => void
  onAccountSetup: () => void
}

export const AccountSetup: React.FC<AccoutSetupProps> = ({
  organization,
  organizationAccount,
  personalAccount,
  loading,
  onLinkAccount,
  onAccountSetup,
}) => {
  const currentAccount = organizationAccount || personalAccount
  const bothOrganizationAndPersonal =
    organizationAccount !== undefined &&
    personalAccount !== undefined &&
    organizationAccount.id !== personalAccount.id
  const isActive = currentAccount?.status === 'active'
  const isUnderReview = currentAccount?.status === 'under_review'

  const goToOnboarding = async (account: schemas['Account']) => {
    const link = await unwrap(
      api.POST('/v1/accounts/{id}/onboarding_link', {
        params: {
          path: { id: account.id },
          query: {
            return_path: organization
              ? `/dashboard/${organization.slug}/finance/account`
              : '/finance/account',
          },
        },
      }),
    )
    window.location.href = link.url
  }

  const goToDashboard = async (account: schemas['Account']) => {
    const link = await unwrap(
      api.POST('/v1/accounts/{id}/dashboard_link', {
        params: {
          path: { id: account.id },
        },
      }),
    )
    window.open(link.url, '_blank')
  }

  return (
    <div className="flex flex-col gap-y-4">
      {/* TODO: User linking can be removed with issue funding later */}
      <div className="flex flex-col gap-6 text-sm">
        {bothOrganizationAndPersonal && (
          <>
            <p>
              You have two payout accounts selected, both as a backer and
              maintainer. We recommend you to select one or the other.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => onLinkAccount(personalAccount.id)}
                loading={loading}
                disabled={loading}
              >
                Keep the backer account on{' '}
                {ACCOUNT_TYPE_DISPLAY_NAMES[personalAccount.account_type]} (
                <AccountAssociations
                  account={personalAccount}
                  prefix="used by"
                />
                )
              </Button>
              <Button
                variant="secondary"
                onClick={() => onLinkAccount(organizationAccount.id)}
                loading={loading}
                disabled={loading}
              >
                Keep the maintainer account on{' '}
                {ACCOUNT_TYPE_DISPLAY_NAMES[organizationAccount.account_type]} (
                <AccountAssociations
                  account={organizationAccount}
                  prefix="used by"
                />
                )
              </Button>
            </div>
          </>
        )}
        {!currentAccount && (
          <>
            {organization && (
              <p>
                Your organization{' '}
                <span className="font-medium">{organization.name}</span> does
                not have a payout account setup.
              </p>
            )}
            {!organization && (
              <p>You don&apos;t have a payout account setup.</p>
            )}

            <Button
              className="w-full whitespace-nowrap md:w-fit md:grow-0 md:self-start"
              onClick={onAccountSetup}
              disabled={loading}
            >
              Create new account
            </Button>
          </>
        )}
        {currentAccount && !bothOrganizationAndPersonal && isUnderReview && (
          <>
            <p>
              Your payout account is under review. It has reached a transaction
              threshold, and as part of our security measures, we are now
              conducting a review.
            </p>
            <p>Payouts are not possible during this brief evaluation period.</p>
          </>
        )}
        {currentAccount &&
          !bothOrganizationAndPersonal &&
          !isActive &&
          !isUnderReview && (
            <>
              <p>You need to continue the setup of your payout account.</p>
              <Button
                className="self-start whitespace-nowrap sm:w-auto sm:grow"
                onClick={() => goToOnboarding(currentAccount)}
              >
                Continue setup
              </Button>
            </>
          )}
        {currentAccount && !bothOrganizationAndPersonal && isActive && (
          <>
            <p>Your payout account is setup and ready to receive transfers!</p>
            <Button
              className="self-start whitespace-nowrap sm:w-auto sm:grow"
              onClick={() => goToDashboard(currentAccount)}
            >
              Open dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default AccountSetup
