import { schemas } from '@polar-sh/client'
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
    <div className="flex items-start gap-2">
      <div className="flex flex-row gap-4">
        <div className="text-sm">{transactionMeta.type}</div>
        {transactionMeta.meta && (
          <>
            {'product' in transactionMeta.meta &&
              transactionMeta.meta.product && (
                <span className="dark:text-polar-500 truncate text-sm text-gray-500">
                  {transactionMeta.meta.product.name}
                </span>
              )}
            {'issue_reference' in transactionMeta.meta && (
              <div>{transactionMeta.meta.issue_reference}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TransactionMeta
