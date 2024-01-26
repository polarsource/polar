'use client'

import AccountAssociations from '@/components/Accounts/AccountAssociations'
import { Account, Organization, Status } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { ACCOUNT_TYPE_DISPLAY_NAMES } from 'polarkit/account'
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms'
import { Form, FormField } from 'polarkit/components/ui/form'
import { SelectContent, SelectItem } from 'polarkit/components/ui/select'
import { Separator } from 'polarkit/components/ui/separator'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

interface AccoutSetupProps {
  organization: Organization | undefined
  accounts: Account[]
  organizationAccount: Account | undefined
  personalAccount?: Account
  loading: boolean
  onLinkAccount: (accountId: string) => void
  onAccountSetup: () => void
}

export const AccountSetup: React.FC<AccoutSetupProps> = ({
  organization,
  accounts,
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
  const isActive =
    currentAccount?.status === Status.UNREVIEWED ||
    currentAccount?.status === Status.ACTIVE
  const isUnderReview = currentAccount?.status === Status.UNDER_REVIEW

  const linkAccountForm = useForm<{ account_id: string }>()
  const { control, handleSubmit } = linkAccountForm

  const goToOnboarding = async (account: Account) => {
    const link = await api.accounts.onboardingLink({
      id: account.id,
      returnPath:
        !organization || organization.is_personal
          ? '/finance/account'
          : `/maintainer/${organization.name}/finance/account`,
    })
    window.location.href = link.url
  }

  const goToDashboard = async (account: Account) => {
    const link = await api.accounts.dashboardLink({
      id: account.id,
    })
    window.location.href = link.url
  }

  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 min-h-[150px] rounded-3xl bg-white p-12',
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-y-2">
          <h2 className="text-lg font-medium">Payout account</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Account where you can receive money transfers from Polar
          </p>
        </div>
      </div>
      <Separator className="my-8" />
      <div className="flex flex-col gap-2 text-sm">
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
                You don&apos;t have a payout account setup for{' '}
                <span className="font-medium">{organization.name}</span>.
              </p>
            )}
            {!organization && (
              <p>You don&apos;t have a payout account setup.</p>
            )}

            {accounts.length > 0 && (
              <p>
                You can select one of your existing account or create a new one.{' '}
                {accounts.length === 0 && ' You should create one.'}
              </p>
            )}
            <div className="min-h-12 flex flex-col items-center gap-4 sm:flex-row">
              {accounts.length > 0 && (
                <Form {...linkAccountForm}>
                  <form
                    onSubmit={handleSubmit((data) =>
                      onLinkAccount(data.account_id),
                    )}
                    className="flex w-full flex-col items-center gap-4 sm:w-3/4 sm:flex-row"
                  >
                    <div className="w-full sm:grow">
                      <FormField
                        control={control}
                        name="account_id"
                        rules={{ required: 'This field is required' }}
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an existing payout account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  <div className="flex flex-row gap-2">
                                    <div>
                                      {
                                        ACCOUNT_TYPE_DISPLAY_NAMES[
                                          account.account_type
                                        ]
                                      }
                                    </div>
                                    <div className="dark:text-polar-500 text-sm text-gray-500">
                                      <AccountAssociations
                                        account={account}
                                        prefix="Used by"
                                      />
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      className="w-full sm:w-1/4"
                      loading={loading}
                      disabled={loading}
                    >
                      Link account
                    </Button>
                    <Separator
                      orientation="vertical"
                      className="hidden h-12 sm:block"
                    />
                  </form>
                </Form>
              )}
              <Button
                className="w-full sm:w-auto sm:grow"
                onClick={onAccountSetup}
                disabled={loading}
              >
                Create new account
              </Button>
            </div>
          </>
        )}
        {currentAccount && !bothOrganizationAndPersonal && isUnderReview && (
          <>
            <p>
              Your payout account is under review. It has reached a transaction
              threshold, and as part of our security measures, we are now
              conducting a review.
            </p>
            <p>
              Transfers are temporarily paused during this brief evaluation
              period.
            </p>
          </>
        )}
        {currentAccount &&
          !bothOrganizationAndPersonal &&
          !isActive &&
          !isUnderReview && (
            <>
              <p>You need to continue the setup of your payout account.</p>
              <Button
                className="self-start sm:w-auto sm:grow"
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
              className="self-start sm:w-auto sm:grow"
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
