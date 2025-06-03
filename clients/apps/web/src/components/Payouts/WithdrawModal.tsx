import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from '../Modal'
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
      className="min-w-[400px]"
      isShown={isShown}
      hide={hide}
      modalContent={
        <>
          <div className="overflow-scroll p-8">
            {errorMessage && (
              <>
                <div className="text-center text-red-500 dark:text-red-400">
                  {errorMessage}
                </div>
                <div className="flex flex-row items-center justify-center gap-x-4 pt-6">
                  <Button variant="default" onClick={hide}>
                    Close
                  </Button>
                </div>
              </>
            )}
            {payoutEstimate && (
              <>
                <div className="flex flex-col items-center gap-8">
                  <div>
                    You&apos;re about to withdraw your balance to your bank
                    account.
                  </div>
                  {payoutEstimate.fees_amount === 0 && (
                    <>
                      <div>
                        The following amount will be deposited to your bank
                        account.
                      </div>
                      <div className="text-4xl text-green-500 dark:text-green-400">
                        {formatCurrencyAndAmount(payoutEstimate.net_amount)}
                      </div>
                    </>
                  )}
                  {payoutEstimate.fees_amount > 0 && (
                    <>
                      <div>The following processing fees will incur.</div>
                      <div className="flex flex-row items-center gap-4">
                        <div className="text-4xl">
                          {formatCurrencyAndAmount(payoutEstimate.gross_amount)}
                        </div>
                        <div className="border-muted-foreground h-0 w-12 border-t-2 border-dashed"></div>
                        <div className="text-2xl text-red-500 dark:text-red-400">
                          {formatCurrencyAndAmount(payoutEstimate.fees_amount)}
                        </div>
                        <div className="border-muted-foreground h-0 w-12 border-t-2 border-dashed"></div>
                        <div className="text-4xl text-green-500 dark:text-green-400">
                          {formatCurrencyAndAmount(payoutEstimate.net_amount)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-row items-center justify-center gap-x-4 pt-6">
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
              </>
            )}
          </div>
        </>
      }
    />
  )
}

export default WithdrawModal
