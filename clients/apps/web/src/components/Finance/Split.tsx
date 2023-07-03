import { PlusIcon } from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { PledgeRead, UserRead } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'
import { useMemo, useState } from 'react'
import Banner from '../Banner/Banner'

export type Share = {
  username: string
  share?: number
  raw_value?: string
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

const zeroIsNanOrInfinite = (value: number): number => {
  if (isNaN(value) || !isFinite(value)) {
    return 0
  }
  return value
}

const Split = (props: {
  pledges: PledgeRead[]
  contributors: UserRead[]
  shares: Share[]
}) => {
  const [shares, setShares] = useState(props.shares)

  const pledgeSum = props.pledges
    .map((p) => p.amount)
    .reduce((a, b) => a + b, 0)

  const polarShare = pledgeSum * 0.1
  const pledgeSumToSplit = pledgeSum - polarShare

  const isFixed = (share: number | undefined): boolean => {
    return share !== undefined && !isNaN(share) && isFinite(share)
  }

  const computedShares = useMemo(() => {
    const fixedShares = shares.filter((s) => isFixed(s.share))

    const fixedSharesSum = fixedShares
      .map((s) => s.share || 0)
      .reduce((a, b) => a + b, 0)

    const remainingUsersCount = shares.length - fixedShares.length

    const deducedShare = (): number => {
      if (fixedSharesSum >= 1) {
        return 0
      }
      return (1 - fixedSharesSum) / remainingUsersCount
    }

    return shares
      .map((s) => {
        const share = s.share || deducedShare()

        const user = props.contributors.find((c) => c.username === s.username)

        const percent = zeroIsNanOrInfinite(share * 100)

        const est_amount = zeroIsNanOrInfinite(
          (pledgeSumToSplit * percent) / 100,
        )

        return {
          username: user?.username,
          avatar_url: user?.avatar_url,
          is_fixed: isFixed(s.share),
          placeholder_percent: percent,
          est_amount,
          raw_value: s.raw_value,
          share,
        }
      })
      .filter((s) => s.username) as Array<{
      username: string
      avatar_url: string
      is_fixed: boolean
      placeholder_percent: number
      est_amount: number
      raw_value: string | undefined
      share: number
    }>
  }, [shares])

  const sumShares = useMemo(
    () =>
      Math.round(
        computedShares.map((s) => s.share).reduce((a, b) => a + b, 0) * 100,
      ),
    [computedShares],
  )

  const prettifyNumber = (value: string): string => {
    const num = parseFloat(value)

    if (num.toString() !== value) {
      return value
    }

    return (Math.floor(num * 100) / 100).toString()
  }

  const onUpdate = (username: string, value: string) => {
    const share = parseFloat(value) / 100

    setShares((prev) =>
      prev.map((s) => {
        if (s.username === username) {
          return {
            ...s,
            share,
            raw_value: value,
          }
        }
        return s
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2>Split reward (${getCentsInDollarString(pledgeSum)})</h2>
      <div className="flex flex-col gap-4">
        {computedShares.map((s) => (
          <div className="flex items-center space-x-2">
            <div>
              <img src={s.avatar_url} className="h-6 w-6 rounded-full" />
            </div>
            <span className="flex-1 text-gray-900 dark:text-gray-200">
              {s.username}
            </span>
            <div className="text-gray-500">
              Est. $
              {getCentsInDollarString(
                Math.round(s.est_amount * 100) / 100,
                true,
              )}
            </div>
            <div className="flex w-[120px] items-center gap-1 overflow-hidden rounded-lg border bg-white py-2 px-3 pr-1.5">
              <span className="flex-shrink-0 text-gray-500">%</span>
              <div className="flex-1">
                <input
                  className={classNames(
                    'w-full',
                    s.is_fixed ? 'font-medium text-black' : 'text-gray-500',
                  )}
                  value={prettifyNumber(s.raw_value)}
                  placeholder={prettifyNumber(s.placeholder_percent.toString())}
                  onChange={(e) => onUpdate(s.username, e.target.value)}
                />
              </div>
              {s.is_fixed && (
                <XMarkIcon
                  className="h-6 w-6 flex-shrink-0 cursor-pointer text-gray-500 hover:text-gray-600"
                  onClick={() => onUpdate(s.username, '')}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="flex flex-1 items-center space-x-2">
          <PlusIcon className="h-6 w-6" />
          <input
            placeholder="Add a Github user..."
            className="dark:bg-gray-900"
          />
        </div>
        <div>
          Total:{' '}
          <strong>${getCentsInDollarString(pledgeSumToSplit, true)}</strong>
        </div>
      </div>
      {sumShares < 100 && (
        <Banner color="red">
          Missing {prettifyNumber((100 - sumShares).toString())} percentage
          points
        </Banner>
      )}
      {sumShares > 100 && (
        <Banner color="red">
          {prettifyNumber((sumShares - 100).toString())} too many percentage
          points allocated
        </Banner>
      )}
      <div>
        Polar’s fee of ${getCentsInDollarString(polarShare, true)} has been
        subtracted from the total
      </div>
    </div>
  )
}

export default Split
