import { api } from '@/utils/client'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../Modal'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'

interface WithdrawModalProps {
  account: schemas['Account']
  organization: schemas['Organization']
  isShown: boolean
  hide: () => void
  onSuccess?: (payoutId: string) => void
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  account,
  organization,
  isShown,
  hide,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [payoutEstimate, setPayoutEstimate] = useState<
    schemas['PayoutEstimate'] | null
  >(null)
  const canWithdraw = useMemo(
    () => organization.status === 'active',
    [organization.status],
  )

  const getPayoutEstimate = useCallback(async () => {
    if (!canWithdraw) {
      return
    }

    const { data, error } = await api.GET('/v1/payouts/estimate', {
      params: { query: { account_id: account.id } },
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
  }, [account, canWithdraw])

  useEffect(() => {
    if (isShown) {
      getPayoutEstimate()
    }
  }, [isShown, getPayoutEstimate])

  const [loading, setLoading] = useState(false)
  const onConfirm = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.POST('/v1/payouts/', {
      body: { account_id: account.id },
    })
    setLoading(false)

    if (error) {
      toast({
        title: 'Withdrawal Failed',
        description: `Error initiating withdrawal: ${error.detail}`,
      })
      return
    }

    toast({
      title: 'Withdrawal Initiated',
      description: `Withdrawal initiated successfully`,
    })

    onSuccess?.(data.id)
  }, [account.id, onSuccess])

  return (
    <Modal
      title="Withdraw Balance"
      className="min-w-[400px]"
      isShown={isShown}
      hide={hide}
      modalContent={
        <>
          <div className="overflow-scroll p-6">
            {!canWithdraw && (
              <div className="flex flex-col gap-6">
                <p>
                  Your organization is currently under review, as part of our
                  compliance process. Withdrawals are disabled until the review
                  is complete.
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
                      <ArrowOutwardOutlined
                        className="ml-2"
                        fontSize="inherit"
                      />
                    </Button>
                  </Link>
                </p>
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
                      value={formatCurrencyAndAmount(
                        payoutEstimate.gross_amount,
                        'usd',
                      )}
                    />
                    <DetailRow
                      label="Fees Amount"
                      valueClassName="justify-end"
                      value={formatCurrencyAndAmount(
                        payoutEstimate.fees_amount,
                        'usd',
                      )}
                    />
                    <DetailRow
                      label="Net Amount"
                      valueClassName="justify-end"
                      value={formatCurrencyAndAmount(
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
        </>
      }
    />
  )
}

export default WithdrawModal
