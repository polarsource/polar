import { Badge } from 'polarkit/components'

const FakePullRequest = ({ showAmount }: { showAmount: boolean }) => {
  return (
    <div className="overflow-hidden rounded-lg border-[1px] border-[#E1E4E6]">
      <div className="inline-flex w-full items-center space-x-2 border-b-[1px] border-[#C8CFDA] bg-[#F6F8FA] px-4 py-2 text-sm text-[#909FB1]">
        <span>
          <strong className="font-medium text-black/70">janedoe</strong>{' '}
          commented 2 days ago &mdash; edited by Polar
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
