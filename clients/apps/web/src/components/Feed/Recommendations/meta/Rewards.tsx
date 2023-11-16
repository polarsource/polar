import { AttachMoneyOutlined } from '@mui/icons-material'
import { IssueSummary } from 'polarkit/components/Issue'
import { RewardsRecommendation } from '../../data'

export const RewardsMeta = (props: RewardsRecommendation) => {
  return (
    <div className="flex flex-col">
      <div className="dark:border-polar-700 flex flex-row items-center gap-x-4 border-b border-gray-100 p-6 ">
        <div className="dark:bg-polar-700 flex h-10 w-10 flex-col items-center justify-center rounded-full bg-blue-100 text-center">
          <AttachMoneyOutlined
            className="ml-0.5 text-blue-500"
            fontSize="medium"
          />
        </div>
        <div className="flex flex-col">
          <h3 className="dark:text-polar-50 font-medium text-gray-950">
            Issues with upfront rewards
          </h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Help out and get paid for your efforts
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-y-2 p-6 ">
        {props.issues.map((issue) => (
          <IssueSummary key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  )
}
