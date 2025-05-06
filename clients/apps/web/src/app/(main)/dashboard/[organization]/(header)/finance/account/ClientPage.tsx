'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { useAuth } from '@/hooks'
import {
  useCreateIdentityVerification,
  useListAccounts,
  useOrganizationAccount,
} from '@/hooks/queries'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@polar-sh/ui/components/ui/accordion'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { loadStripe } from '@stripe/stripe-js'
import { CircleCheck, CircleDot } from 'lucide-react'
import { useCallback, useState } from 'react'

const ReviewStep = ({
  id,
  title,
  available,
  done,
  children,
}: {
  id: string
  title: string
  available: boolean
  done: boolean
  children: React.ReactNode
}) => {
  const disabled = !available
  return (
    <AccordionItem value={id} disabled={disabled}>
      <AccordionTrigger className={done ? 'opacity-50' : ''}>
        <div className="flex items-center gap-2">
          {done ? (
            <CircleCheck className="h-4 w-4" />
          ) : (
            <CircleDot className="h-4 w-4" />
          )}
          {title}
        </div>
      </AccordionTrigger>
      <AccordionContent className="dark:bg-polar-800 mb-4 rounded-xl bg-gray-100 p-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { currentUser, reloadUser } = useAuth()
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const [requireDetails, setRequireDetails] = useState(
    !organization.details_submitted_at,
  )
  const identityVerified = currentUser?.identity_verified
  const identityVerificationStatus = currentUser?.identity_verification_status

  const [step, setStep] = useState<string | undefined>()

  const { data: organizationAccount } = useOrganizationAccount(organization.id)

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')
  const createIdentityVerification = useCreateIdentityVerification()
  const startIdentityVerification = useCallback(async () => {
    const { data, error } = await createIdentityVerification.mutateAsync()
    if (error) {
      return
    }
    const stripe = await stripePromise
    if (!stripe) {
      return
    }
    const { error: stripeError } = await stripe.verifyIdentity(
      data.client_secret,
    )
    if (stripeError) {
      return
    }
    await reloadUser()
  }, [createIdentityVerification, stripePromise, reloadUser])

  const [linkAccountLoading, setLinkAccountLoading] = useState(false)
  const onLinkAccount = useCallback(
    async (accountId: string) => {
      setLinkAccountLoading(true)
      const { error } = await api.PATCH('/v1/organizations/{id}/account', {
        params: { path: { id: organization.id } },
        body: { account_id: accountId },
      })
      setLinkAccountLoading(false)
      if (!error) {
        window.location.reload()
      }
    },
    [organization],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <Accordion
        type="single"
        collapsible
        className="w-full"
        value={step}
        onValueChange={setStep}
      >
        <ReviewStep
          id="details"
          title="Provide your organization details"
          available={true}
          done={!requireDetails}
        >
          {requireDetails ? (
            <div className="flex justify-center">
              <div className="w-full lg:w-1/2">
                <OrganizationProfileSettings
                  organization={organization}
                  kyc={true}
                  onSubmitted={() => {
                    setRequireDetails(false)
                    if (!organizationAccount) {
                      setStep('account')
                    } else if (!identityVerified) {
                      setStep('identity')
                    } else {
                      setStep(undefined)
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <p>Thank you, your organization details have been submitted.</p>
          )}
        </ReviewStep>
        <ReviewStep
          id="account"
          title="Create a payout account"
          available={!requireDetails}
          done={!!organizationAccount}
        >
          {accounts ? (
            <AccountSetup
              organization={organization}
              organizationAccount={organizationAccount}
              loading={linkAccountLoading}
              pauseActions={requireDetails}
              onLinkAccount={onLinkAccount}
              onAccountSetup={showSetupModal}
            />
          ) : null}
        </ReviewStep>
        <ReviewStep
          id="identity"
          title="Verify your identity"
          available={!requireDetails && !!organizationAccount}
          done={!!identityVerified}
        >
          <div className="flex flex-col gap-2">
            {identityVerificationStatus === 'verified' && (
              <p>Thank you, your identity has been verified!</p>
            )}
            {identityVerificationStatus === 'pending' && (
              <p>
                Your identity verification is pending. Please check back later.
              </p>
            )}
            {identityVerificationStatus === 'failed' && (
              <p>Your identity verification failed. Please try again.</p>
            )}
            {identityVerificationStatus &&
              ['unverified', 'failed'].includes(identityVerificationStatus) && (
                <div>
                  <Button
                    size="sm"
                    onClick={startIdentityVerification}
                    loading={createIdentityVerification.isPending}
                  >
                    Verify my identity
                  </Button>
                </div>
              )}
          </div>
        </ReviewStep>
      </Accordion>

      {accounts?.items && accounts.items.length > 0 ? (
        <ShadowBoxOnMd>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium">All payout accounts</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Payout accounts you manage
              </p>
            </div>
          </div>
          <Separator className="my-8" />
          {accounts?.items && (
            <AccountsList
              accounts={accounts?.items}
              pauseActions={requireDetails}
              returnPath={`/dashboard/${organization.slug}/finance/account`}
            />
          )}
        </ShadowBoxOnMd>
      ) : null}

      <Modal
        isShown={isShownSetupModal}
        className="min-w-[400px]"
        hide={hideSetupModal}
        modalContent={
          <AccountCreateModal
            forOrganizationId={organization.id}
            returnPath={`/dashboard/${organization.slug}/finance/account`}
          />
        }
      />
    </div>
  )
}
