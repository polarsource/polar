import { PledgeRead } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/utils'

interface Props {
  pledges: PledgeRead[]
}

const IssuePledge = (props: Props) => {
  const { pledges } = props

  const totalPledgeAmount = pledges.reduce(
    (accumulator, pledge) => accumulator + pledge.amount,
    0,
  )

  return (
    <div className="flex items-center gap-2">
      <p className="space-x-1 rounded-2xl bg-blue-800 px-3 py-1 text-sm text-blue-300 dark:bg-blue-200 dark:text-blue-700">
        ${' '}
        <span className="text-blue-100 dark:text-blue-900">
          {getCentsInDollarString(totalPledgeAmount)}
        </span>
      </p>
    </div>
  )
}

export default IssuePledge
