import { type PledgeRead } from '../api/client'
import { getCentsInDollarString } from '../utils'

const IssuePledge = (props: { pledge: PledgeRead }) => {
  const { pledge } = props
  return (
    <div className="flex items-center justify-between ">
      <div className="flex items-center gap-2">
        <span className="space-x-1 rounded-xl bg-[#FFE794] px-1.5 py-0.5 text-[#574814]">
          <span className="text-md">🏆</span>
          <span className="text-sm font-medium">
            ${getCentsInDollarString(pledge.amount)}
          </span>
        </span>
        <span className="text-sm text-gray-500">
          contributed by{' '}
          {pledge.pledger_name && <span>{pledge.pledger_name}</span>}
          {!pledge.pledger_name && <span>anonymous</span>}
        </span>
      </div>

      <div>
        {pledge.state === 'created' && (
          <span className="text-gray-300">Awaiting fix</span>
        )}
        {pledge.state === 'pending' && (
          <span className="text-gray-300">Pending payout</span>
        )}
        {pledge.state === 'paid' && (
          <span className="text-gray-300">Paid to maintainer</span>
        )}
      </div>
    </div>
  )
}

export default IssuePledge
