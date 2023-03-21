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
          <span className="border-2 border-pink-800 text-purple-500">
            Google
          </span>
        </span>
      </div>
      <a href="#" className="border-2 border-pink-800 text-sm text-gray-500">
        Reward Details &rsaquo;
      </a>
    </div>
  )
}

export default IssuePledge
