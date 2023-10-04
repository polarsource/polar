interface PublicRewardPillProps {
  percent: number
}

const PublicRewardPill: React.FC<PublicRewardPillProps> = ({ percent }) => {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-blue-200 py-0.5 pl-2 pr-0.5 text-xs text-gray-900 dark:border-blue-800 dark:text-gray-200">
      <div>Public Reward</div>
      <div
        className="rounded-xl bg-blue-100 px-1 dark:bg-blue-700"
        style={{ fontSize: 10 }}
      >
        {percent}%
      </div>
    </div>
  )
}

export default PublicRewardPill
