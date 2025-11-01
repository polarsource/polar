import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from '../Modal'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'

interface WithdrawModalProps {
  account: schemas['Account']
  isShown: boolean
  hide: () => void
  onSuccess?: (payoutId: string) => void
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  account,
  isShown,
  hide,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [payoutEstimate, setPayoutEstimate] = useState<
    schemas['PayoutEstimate'] | null
  >(null)

  const getPayoutEstimate = useCallback(async () => {
    const { data, response } = await api.GET('/v1/payouts/estimate', {
      params: { query: { account_id: account.id } },
    })
    if (!response.ok) {
      const errorBody = await response.json()
      if (errorBody.error === 'InsufficientBalance') {
        setErrorMessage(
          'The balance of this account is insufficient to cover the processing fees.',
        )
      } else {
        setErrorMessage(
          'An error occurred while trying to compute the processing fees. Please try again later.',
        )
      }
      return
    }

    if (data) {
      setPayoutEstimate(data)
    }
  }, [account])

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
          <div className="overflow-scroll p-8">
            {errorMessage && (
              <div className="flex flex-col gap-8">
                <div className="text-red-500 dark:text-red-400">
                  {errorMessage}
                </div>
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
                      )}
                    />
                    <DetailRow
                      label="Fees Amount"
                      valueClassName="justify-end"
                      value={formatCurrencyAndAmount(
                        payoutEstimate.fees_amount,
                      )}
                    />
                    <DetailRow
                      label="Net Amount"
                      valueClassName="justify-end"
                      value={formatCurrencyAndAmount(payoutEstimate.net_amount)}
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
