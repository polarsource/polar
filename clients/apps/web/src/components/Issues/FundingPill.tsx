import { CurrencyAmount } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'

interface FundingPillProps {
  total: CurrencyAmount
  goal?: CurrencyAmount
}

const FundingPill: React.FC<FundingPillProps> = ({ total, goal }) => {
  return (
    <p className="flex-shrink-0 rounded-2xl bg-blue-100 px-3 py-1 text-sm text-blue-500 dark:bg-blue-200 dark:text-blue-700">
      ${' '}
      <span className="whitespace-nowrap text-blue-500 dark:text-blue-900">
        {getCentsInDollarString(total.amount, false, true)}
      </span>
      {goal && (
        <span className="whitespace-nowrap text-blue-500/70 dark:text-blue-900/70">
          &nbsp;/ ${getCentsInDollarString(goal.amount, false, true)}
        </span>
      )}
    </p>
  )
}

export default FundingPill
