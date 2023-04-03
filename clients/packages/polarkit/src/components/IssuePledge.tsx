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
        <span className="text-gray-300">(state={pledge.state}) </span>
        <a href="#" className="border-2 border-pink-800 text-sm text-gray-500">
          Reward Details &rsaquo;
        </a>
      </div>
    </div>
  )
}

export default IssuePledge
