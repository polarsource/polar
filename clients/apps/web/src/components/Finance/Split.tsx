import { XMarkIcon } from '@heroicons/react/24/outline'
import { PledgeRead, UserRead } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'

export type Share = {
  username: string
  share?: number
}

const Split = (props: {
  pledges: PledgeRead[]
  contributors: UserRead[]
  shares: Share[]
}) => {
  const pledgeSum = props.pledges
    .map((p) => p.amount)
    .reduce((a, b) => a + b, 0)

  const polarShare = pledgeSum * 0.1
  const pledgeSumToSplit = pledgeSum - polarShare

  const fixedShares = props.shares
    .map((s) => s.share || 0)
    .reduce((a, b) => a + b, 0)

  const remainingUsersCount = props.shares.filter(
    (s) => s.share === undefined,
  ).length

  const computedShares = props.shares.map((s) => {
    const share = s.share || (1 - fixedShares) / remainingUsersCount
    const estAmount = pledgeSumToSplit * share

    return {
      user: props.contributors.find((c) => c.username === s.username),
      isFixed: s.share !== undefined,
      percent: share * 100,
      estAmount,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <h2>Split reward (${getCentsInDollarString(pledgeSum)})</h2>
      <div className="flex flex-col gap-4">
        {computedShares.map((s) => (
          <div className="items-centers flex space-x-2">
            <div>
              <img src={s.user?.avatar_url} className="h-6 w-6 rounded-full" />
            </div>
            <span className="flex-1 text-gray-900 dark:text-gray-200">
              {s.user?.username}
            </span>
            <span className="text-gray-500">
              Est. $
              {getCentsInDollarString(
                Math.round(s.estAmount * 100) / 100,
                true,
              )}
            </span>
            <div className="flex w-[120px] items-center gap-1 overflow-hidden rounded-lg border bg-white py-2 px-3">
              <span className="text-gray-500">%</span>
              <input
                className={classNames(
                  'w-[60px] flex-1 ',
                  s.isFixed ? 'font-medium text-black' : 'text-gray-500',
                )}
                value={Math.round(s.percent * 100) / 100}
              />
              {s.isFixed && (
                <XMarkIcon className="h-6 w-6 cursor-pointer hover:text-gray-500" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div>
        Polar’s fee of ${getCentsInDollarString(polarShare, true)} has been
        subtracted from the total
      </div>
    </div>
  )
}

export default Split
