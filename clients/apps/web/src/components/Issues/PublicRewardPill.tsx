interface PublicRewardPillProps {
  percent: number
}

const PublicRewardPill: React.FC<PublicRewardPillProps> = ({ percent }) => {
  return (
    <div className="dark:text-polar-50 flex items-center gap-2 whitespace-nowrap rounded-xl border border-blue-200 py-0.5 pl-2 pr-0.5 text-xs text-gray-900 dark:border-blue-400">
      <div>Public Reward</div>
      <div
        className="rounded-xl bg-blue-200 px-1 dark:bg-blue-400"
        style={{ fontSize: 10 }}
      >
        {percent}%
      </div>
    </div>
  )
}

export default PublicRewardPill
