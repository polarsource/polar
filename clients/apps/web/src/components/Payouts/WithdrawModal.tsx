import { extractApiErrorMessage } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { usePayouts } from '@/hooks/queries/payouts'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { isValidationError, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../Modal'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'
import SpinnerNoMargin from '../Shared/Spinner'

interface WithdrawModalProps {
  organization: schemas['Organization']
  account: schemas['Account']
  isShown: boolean
  hide: () => void
  onSuccess?: (payoutId: string) => void
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  organization,
  account,
  isShown,
  hide,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [payoutEstimate, setPayoutEstimate] = useState<
    schemas['PayoutEstimate'] | null
  >(null)
  const canWithdraw = useMemo(
    () => organization.capabilities.payouts,
    [organization.capabilities.payouts],
  )

  const { data: latestPayouts, isPending } = usePayouts(account.id, {
    limit: 1,
    sorting: ['-created_at'],
  })

  const nextPayoutAt = useMemo(() => {
    const latest = latestPayouts?.items?.[0]
    if (!latest) {
      return null
    }
    return new Date(
      new Date(latest.created_at).getTime() + account.payout_interval * 1000,
    )
  }, [latestPayouts, account.payout_interval])

  const isPayoutIntervalLimited = useMemo(
    () => nextPayoutAt !== null && nextPayoutAt > new Date(),
    [nextPayoutAt],
  )

  const getPayoutEstimate = useCallback(async () => {
    if (!canWithdraw || isPayoutIntervalLimited) {
      return
    }

    const { data, error } = await api.GET('/v1/payouts/estimate', {
      params: { query: { organization_id: organization.id } },
    })
    if (error) {
      if (isValidationError(error.detail)) {
        setErrorMessage(
          'An error occurred while trying to compute the processing fees. Please try again later.',
        )
      } else if (error.detail) {
        setErrorMessage(error.detail)
      }

      return
    }

    if (data) {
      setPayoutEstimate(data)
    }
  }, [organization, canWithdraw, isPayoutIntervalLimited])

  /* eslint-disable react-hooks/set-state-in-effect -- fetches payout estimate when modal opens */
  useEffect(() => {
    if (isShown) {
      getPayoutEstimate()
    }
  }, [isShown, getPayoutEstimate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const [loading, setLoading] = useState(false)
  const onConfirm = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.POST('/v1/payouts/', {
      body: { organization_id: organization.id },
    })
    setLoading(false)

    if (error) {
      toast({
        title: 'Withdrawal Failed',
        description: `Error initiating withdrawal: ${extractApiErrorMessage(error)}`,
      })
      return
    }

    toast({
      title: 'Withdrawal Initiated',
      description: `Withdrawal initiated successfully`,
    })

    onSuccess?.(data.id)
  }, [organization, onSuccess])

  if (isPending) {
    return (
      <Modal
        title="Withdraw Balance"
        className="min-w-100"
        isShown={isShown}
        hide={hide}
        modalContent={
          <div className="flex flex-col items-center justify-between overflow-auto p-6">
            <SpinnerNoMargin />
          </div>
        }
      />
    )
  }

  return (
    <Modal
      title="Withdraw Balance"
      className="min-w-100"
      isShown={isShown}
      hide={hide}
      modalContent={
        <div className="overflow-auto p-6">
          {!canWithdraw && (
            <div className="flex flex-col gap-6">
              <p>
                Your organization is currently under review, as part of our
                compliance process. Withdrawals are disabled until the review is
                complete.
              </p>
              <p>
                <Link
                  href="https://polar.sh/docs/merchant-of-record/account-reviews"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="default"
                    className="flex flex-row items-center"
                  >
                    <span>Learn more</span>
                    <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
                  </Button>
                </Link>
              </p>
            </div>
          )}

          {canWithdraw && isPayoutIntervalLimited && nextPayoutAt && (
            <div className="flex flex-col gap-6">
              <p>
                You&apos;ve recently requested a payout. The next one can be
                requested at{' '}
                <FormattedDateTime datetime={nextPayoutAt} resolution="time" />.
              </p>
              <div className="flex flex-row gap-x-4">
                <Button variant="default" onClick={hide}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex flex-col gap-8">
              <p className="text-black dark:text-white">{errorMessage}</p>
              <div className="flex flex-row gap-x-4">
                <Button variant="default" onClick={hide}>
                  Close
                </Button>
              </div>
            </div>
          )}
          {payoutEstimate && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl">Withdraw your balance</h1>
                  <p className="dark:text-polar-500 text-gray-500">
                    You&apos;re about to withdraw your balance to your bank
                    account.
                  </p>
                </div>

                <div className="flex flex-col">
                  <DetailRow
                    label="Gross Amount"
                    valueClassName="justify-end"
                    value={formatCurrency('accounting')(
                      payoutEstimate.gross_amount,
                      'usd',
                    )}
                  />
                  <DetailRow
                    label="Fees Amount"
                    valueClassName="justify-end"
                    value={formatCurrency('accounting')(
                      payoutEstimate.fees_amount,
                      'usd',
                    )}
                  />
                  <DetailRow
                    label="Net Amount"
                    valueClassName="justify-end"
                    value={formatCurrency('accounting')(
                      payoutEstimate.net_amount,
                      'usd',
                    )}
                  />
                </div>
              </div>
              <div className="flex flex-row gap-x-4">
                <Button
                  variant="default"
                  onClick={onConfirm}
                  loading={loading}
                  disabled={loading}
                >
                  Confirm
                </Button>
                <Button variant="ghost" onClick={hide}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      }
    />
  )
}

export default WithdrawModal
