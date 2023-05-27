import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { CONFIG } from 'polarkit'
import { Badge } from 'polarkit/components'

const FakePullRequest = ({ showAmount }: { showAmount: boolean }) => {
  return (
    <div className="overflow-hidden rounded-lg border-[1px] border-[#E1E4E6]">
      <div className="inline-flex w-full items-center space-x-2 border-b-[1px] border-[#C8CFDA] bg-[#F6F8FA] px-4 py-2 text-sm text-[#909FB1]">
        <span>
          <strong className="font-medium text-black/70">janedoe</strong>{' '}
          commented 2 days ago &mdash; edited by {CONFIG.GITHUB_APP_NAMESPACE}
        </span>
        <div className="rounded-full border-[1px] border-[#C8CFDA] px-2 py-0.5">
          bot
        </div>
      </div>
      <div className="flex flex-col space-y-3.5 p-4 pb-2">
        <div className="h-4 w-full max-w-[250px] rounded-full bg-[#EAEBEC]"></div>
        <div className="h-4 w-full max-w-[500px] rounded-full bg-[#EAEBEC]"></div>
        <div className="h-4 w-full max-w-[400px] rounded-full bg-[#EAEBEC]"></div>
        <PolarBadge showAmount={showAmount} />
        <div className="flex flex-row items-center pb-2 text-gray-500">
          <QuestionMarkCircleIcon
            width={24}
            height={24}
            className="text-gray-300"
          />
          <p className="ml-2 text-xs">
            <strong className="block font-medium">
              How is the badge added?
            </strong>
            Polar edits the issue body to add the badge (SVG) at the end. You
            can remove it at any time.
          </p>
        </div>
      </div>
    </div>
  )
}

const PolarBadge = ({ showAmount }: { showAmount: boolean }) => {
  return (
    <Badge showAmountRaised={showAmount} amountRaised="250" darkmode={false} />
  )
}

export default FakePullRequest
