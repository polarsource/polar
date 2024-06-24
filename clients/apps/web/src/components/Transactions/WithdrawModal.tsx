import { usePayoutEstimate } from '@/hooks/queries'
import { api } from '@/utils/api'
import { Account, ResponseError } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from '../Modal'

interface WithdrawModalProps {
  account: Account
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
  const { data: payoutEstimate, error } = usePayoutEstimate(account.id, isShown)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handleErrorMessage = useCallback(async () => {
    if (!error) {
      setErrorMessage(null)
      return
    }

    if (error instanceof ResponseError) {
      const body = await error.response.json()
      if (body.error === 'InsufficientBalance') {
        setErrorMessage(
          'The balance of this account is insufficient to cover the processing fees.',
        )
        return
      }
    }

    setErrorMessage(
      'An error occurred while trying to compute the processing fees. Please try again later.',
    )
  }, [error])
  useEffect(() => {
    handleErrorMessage()
  }, [handleErrorMessage])

  const [loading, setLoading] = useState(false)
  const onConfirm = useCallback(async () => {
    setLoading(true)
    try {
      const { id } = await api.transactions.createPayout({
        payoutCreate: { account_id: account.id },
      })
      if (onSuccess) {
        onSuccess(id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
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
                <div className="flex flex-col items-center gap-8 ">
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
                        <div className="border-muted-foreground h-0 w-12 border-t-2  border-dashed"></div>
                        <div className="text-2xl text-red-500 dark:text-red-400">
                          {formatCurrencyAndAmount(payoutEstimate.fees_amount)}
                        </div>
                        <div className="border-muted-foreground h-0 w-12 border-t-2  border-dashed"></div>
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
