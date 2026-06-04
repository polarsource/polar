import { schemas } from '@polar-sh/client'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { useMemo } from 'react'

const getTransactionMeta = (transaction: schemas['Transaction']) => {
  if (transaction.order) {
    return {
      type: transaction.order.subscription_id ? 'Subscription' : 'Purchase',
      meta: {
        product: transaction.order.product,
      },
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      meta: transaction.pledge,
    }
  } else if (transaction.pledge) {
    return {
      type: 'Pledge',
      meta: transaction.pledge,
    }
  } else if (transaction.type === 'payout') {
    return {
      type: 'Payout',
      meta: undefined,
    }
  }
  return {
    type: transaction.type,
    meta: undefined,
  }
}

interface TransactionMetaProps {
  transaction: schemas['Transaction']
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  const transactionMeta = useMemo(
    () => getTransactionMeta(transaction),
    [transaction],
  )

  return (
    <Tooltip>
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-row gap-3">
          <div className="shrink-0 text-sm capitalize">
            {transactionMeta.type}
          </div>
          {transactionMeta.meta && (
            <>
              {'product' in transactionMeta.meta &&
                transactionMeta.meta.product && (
                  <TooltipTrigger asChild>
                    <span className="dark:text-polar-500 min-w-0 truncate text-sm text-gray-500">
                      {transactionMeta.meta.product.name}
                    </span>
                  </TooltipTrigger>
                )}
              {'product' in transactionMeta.meta &&
              transactionMeta.meta.product ? (
                <TooltipContent>
                  {transactionMeta.meta.product.name}
                </TooltipContent>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Tooltip>
  )
}

export default TransactionMeta
