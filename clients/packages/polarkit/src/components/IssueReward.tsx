import { type RewardRead } from '../api/client'

const IssueReward = (props: { reward: RewardRead }) => {
  const { reward } = props
  return (
    <div className="flex items-center justify-between ">
      <div className="flex gap-2 items-center">
        <span className="space-x-1 rounded-xl bg-[#FFE794] text-[#574814] px-1.5 py-0.5">
          <span className="text-md">🏆</span>
          <span className="text-sm font-medium">${reward.amount}</span>
        </span>
        <span className="text-gray-500 text-sm">
          contributed by{' '}
          <span className="text-purple-500 border-2 border-pink-800">
            Google
          </span>
        </span>
      </div>
      <a href="#" className="text-gray-500 text-sm border-2 border-pink-800">
        Reward Details &rsaquo;
      </a>
    </div>
  )
}

export default IssueReward
