import { useTheme } from 'next-themes'
import { CONFIG } from 'polarkit'
import { Badge } from 'polarkit/components/badge'
import { twMerge } from 'tailwind-merge'

const FakePullRequest = ({
  showAmount,
  large,
  classNames,
}: {
  showAmount: boolean
  large: boolean
  classNames?: string
}) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-700/30 dark:border-polar-600 overflow-hidden rounded-lg border border-gray-200 bg-gray-50',
        classNames,
      )}
    >
      <div className="dark:bg-polar-700 dark:border-polar-600 dark:text-polar-400 inline-flex w-full items-center space-x-2 border-b-[1px] border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-500">
        <span>
          <strong className="dark:text-polar-300 font-medium text-gray-700">
            janedoe
          </strong>{' '}
          commented 2 days ago &mdash; edited by {CONFIG.GITHUB_APP_NAMESPACE}
        </span>
        <div className="dark:border-polar-500 rounded-full border-[1px] border-gray-300 px-2 py-0.5">
          bot
        </div>
      </div>
      <div className="flex flex-col space-y-3.5 p-4 pb-3">
        <div className="dark:bg-polar-600/75 h-4 w-full max-w-[250px] rounded-full bg-gray-200/75"></div>
        {large && (
          <div className="dark:bg-polar-600/75 h-4 w-full max-w-[500px] rounded-full bg-gray-200/75"></div>
        )}
        <div className="dark:bg-polar-600/75 h-4 w-full max-w-[400px] rounded-full bg-gray-200/75"></div>
        <PolarBadge showAmount={showAmount} />
      </div>
    </div>
  )
}

const PolarBadge = ({ showAmount }: { showAmount: boolean }) => {
  const { resolvedTheme } = useTheme()

  return (
    <Badge
      showAmountRaised={showAmount}
      funding={{
        pledges_sum: { currency: 'USD', amount: 2500 },
      }}
      darkmode={resolvedTheme === 'dark' ? true : false}
      avatarsUrls={[]}
    />
  )
}

export default FakePullRequest
