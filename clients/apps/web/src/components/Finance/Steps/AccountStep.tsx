'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { ArrowRight, UserCheck } from 'lucide-react'
import React from 'react'

interface AccountStepProps {
  organizationAccount?: schemas['Account']
  isNotAdmin: boolean
  onStartAccountSetup: () => void
  onSkipAccountSetup?: () => void
}

const StepCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => <Card className={`p-6 ${className}`}>{children}</Card>

export default function AccountStep({
  organizationAccount,
  isNotAdmin,
  onStartAccountSetup,
  onSkipAccountSetup,
}: AccountStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center space-x-3">
          <h1 className="text-2xl font-semibold">Payout Account</h1>
        </div>
        <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
          {organizationAccount?.is_details_submitted
            ? 'Your payout account details and status.'
            : isNotAdmin
              ? 'Account setup requires admin privileges.'
              : 'Set up your Stripe account to receive payments.'}
        </p>
      </div>

      {/* Account Information */}
      {organizationAccount && organizationAccount.is_details_submitted ? (
        <StepCard>
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-gray-50 p-8 dark:bg-gray-800">
              <h4 className="mb-2 font-medium">Account Setup Complete</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your payout account is configured and ready.
              </p>
            </div>
          </div>
        </StepCard>
      ) : (
        <StepCard
          className={isNotAdmin ? 'border-gray-300 dark:border-gray-600' : ''}
        >
          {isNotAdmin ? (
            <div className="space-y-4">
              <div className="space-y-4 text-center">
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 dark:border-gray-600 dark:bg-gray-800">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <UserCheck className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    </div>
                  </div>
                  <h4 className="mb-2 font-medium text-gray-600 dark:text-gray-400">
                    Account Setup Restricted
                  </h4>
                  <p className="mx-auto mb-4 max-w-md text-sm text-gray-500 dark:text-gray-500">
                    You are not the admin of the account. Only the account admin
                    can set up payout accounts.
                  </p>
                  {onSkipAccountSetup && (
                    <Button
                      onClick={onSkipAccountSetup}
                      variant="default"
                      className="w-auto"
                    >
                      Skip & Continue to Identity Verification
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    The account admin will need to complete this step separately
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4 text-center">
                <div className="rounded-lg bg-gray-50 p-8 dark:bg-gray-800">
                  <h4 className="mb-2 font-medium">Create Payout Account</h4>
                  <p className="mx-auto mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                    Connect or create a Stripe account to receive payments from
                    your customers.
                  </p>
                  <Button onClick={onStartAccountSetup} className="w-auto">
                    Continue with Account Setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </StepCard>
      )}
    </div>
  )
}
