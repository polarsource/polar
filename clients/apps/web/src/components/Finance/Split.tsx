import { InformationCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { api } from 'polarkit/api'
import { Pledge } from 'polarkit/api/client'
import { Banner, PrimaryButton } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'
import { FormEvent, useMemo, useState } from 'react'
import { ModalHeader } from '../Modal'

export type Share = {
  username: string
  share_thousands?: number
  raw_value?: string
}

const zeroIfNanOrInfinite = (value: number): number => {
  if (isNaN(value) || !isFinite(value)) {
    return 0
  }
  return value
}

export interface Contributor {
  username: string
  avatar_url?: string
}

const Split = (props: {
  pledges: Pledge[]
  contributors: Contributor[]
  shares: Share[]
  onConfirm: (shares: Share[]) => void
  onCancel: () => void
}) => {
  const [shares, setShares] = useState(props.shares)
  const [contributors, setContributors] = useState(props.contributors)

  const pledgeSum = props.pledges
    .map((p) => p.amount.amount)
    .reduce((a, b) => a + b, 0)

  const polarShare = pledgeSum * 0.1
  const pledgeSumToSplit = pledgeSum - polarShare

  const isFixed = (share: number | undefined): boolean => {
    return share !== undefined && !isNaN(share) && isFinite(share) && share >= 0
  }

  const computedShares = useMemo(() => {
    const fixedShares = shares.filter((s) => isFixed(s.share_thousands))

    const fixedSharesSum = fixedShares
      .map((s) => s.share_thousands || 0)
      .reduce((a, b) => a + b, 0)

    const remainingUsersCount = shares.length - fixedShares.length

    const deducedShare = (): number => {
      if (fixedSharesSum >= 1000) {
        return 0
      }
      return Math.floor((1000 - fixedSharesSum) / remainingUsersCount)
    }

    console.log('calculate computed shares', { shares })

    return shares
      .map((s) => {
        const share_thousands =
          s.share_thousands !== undefined && s.raw_value !== ''
            ? s.share_thousands
            : deducedShare()

        const user = contributors.find((c) => c.username === s.username)

        let percent = zeroIfNanOrInfinite(share_thousands) / 1000
        if (percent < 0) {
          percent = 0
        }

        const est_amount = zeroIfNanOrInfinite(pledgeSumToSplit * percent)

        return {
          username: user?.username,
          avatar_url: user?.avatar_url,
          is_fixed: isFixed(s.share_thousands),
          placeholder_percent: percent * 100,
          est_amount,
          raw_value: s.raw_value,
          share_thousands,
        }
      })
      .filter((s) => s.username) as Array<{
      username: string
      avatar_url: string
      is_fixed: boolean
      placeholder_percent: number
      est_amount: number
      raw_value: string | undefined
      share_thousands: number
    }>
  }, [shares, contributors, pledgeSumToSplit])

  const sumSharesThousands = useMemo(
    () =>
      computedShares.map((s) => s.share_thousands).reduce((a, b) => a + b, 0),
    [computedShares],
  )

  const canSubmit = useMemo(() => {
    return sumSharesThousands === 1000
  }, [sumSharesThousands])

  const prettifyNumber = (value: string): string => {
    const num = parseFloat(value)

    if (num.toString() !== value) {
      return value
    }

    return (Math.round(num * 100) / 100).toString()
  }

  const onUpdate = (username: string, value: string) => {
    const share_thousands = Math.round(parseFloat(value) * 10)

    setShares((prev) =>
      prev.map((s) => {
        if (s.username === username) {
          return {
            ...s,
            share_thousands,
            raw_value: value,
          }
        }
        return s
      }),
    )
  }

  const onConfirm = () => {
    const res = computedShares.map((s) => {
      return {
        username: s.username,
        share_thousands: s.share_thousands,
      }
    })
    props.onConfirm(res)
  }

  const [searchGithubUsername, setSearchGithubUsername] = useState('')
  const [showAddUserError, setShowAddUserError] = useState(false)
  const [showAddUserErrorUsername, setShowAddUserErrorUsername] = useState('')

  const onSearchGithubUsernameSubmit = async (e: FormEvent) => {
    e.stopPropagation()
    e.preventDefault()

    setShowAddUserError(false)

    try {
      const lookup = await api.integrations.lookupUser({
        requestBody: { username: searchGithubUsername },
      })

      // Add to shares if not exists
      if (!shares.find((s) => s.username === lookup.username)) {
        setShares((prev) => [...prev, { username: lookup.username }])
      }

      // Add to contributors if not exists
      if (!contributors.find((c) => c.username === lookup.username)) {
        setContributors((prev) => [...prev, lookup])
      }

      setSearchGithubUsername('')
    } catch {
      setShowAddUserError(true)
      setShowAddUserErrorUsername(searchGithubUsername)
    }
  }

  return (
    <>
      <ModalHeader hide={props.onCancel}>
        <>Split reward (${getCentsInDollarString(pledgeSum)})</>
      </ModalHeader>
      <div className="space-y-4 pt-4">
        <div className="flex flex-col gap-4 px-4">
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
              <div className="flex w-[120px] items-center gap-1 overflow-hidden rounded-lg border bg-white px-3 py-2 pr-1.5">
                <span className="flex-shrink-0 text-gray-500">%</span>
                <div className="flex-1">
                  <input
                    className={classNames(
                      'w-full',
                      s.is_fixed ? 'font-medium text-black' : 'text-gray-500',
                    )}
                    value={prettifyNumber(s.raw_value || '')}
                    placeholder={prettifyNumber(
                      s.placeholder_percent.toString(),
                    )}
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

          <div className="flex">
            <form
              className="flex flex-1 items-center space-x-2"
              onSubmit={onSearchGithubUsernameSubmit}
            >
              <button type="submit">
                <PlusIcon className="h-6 w-6" />
              </button>
              <input
                placeholder="Add a Github user..."
                className="dark:bg-gray-900"
                value={searchGithubUsername}
                onChange={(e) => setSearchGithubUsername(e.target.value)}
              />
            </form>
            <div>
              Total:{' '}
              <strong>${getCentsInDollarString(pledgeSumToSplit, true)}</strong>
            </div>
          </div>

          {sumSharesThousands < 1000 && (
            <Banner color="red">
              Missing{' '}
              {prettifyNumber(((1000 - sumSharesThousands) / 10).toString())}{' '}
              percentage points
            </Banner>
          )}

          {sumSharesThousands > 1000 && (
            <Banner color="red">
              {prettifyNumber(((sumSharesThousands - 1000) / 10).toString())}{' '}
              too many percentage points allocated
            </Banner>
          )}

          {showAddUserError && (
            <Banner color="red">
              Failed to find a GitHub user with username:{' '}
              {showAddUserErrorUsername}, please check your spelling and try
              again.
            </Banner>
          )}
        </div>
        <div className="bg-gray-75 flex items-center px-4 py-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <InformationCircleIcon className="mr-2 h-6 w-6" />
          <div className="w-1-2 mr-4 flex-1 text-sm">
            Polar&apos;s fee of ${getCentsInDollarString(polarShare, true)} has
            been subtracted from the total
          </div>
          <div>
            <button className="mr-4 text-blue-600" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
          <div>
            <PrimaryButton disabled={!canSubmit} onClick={onConfirm}>
              <span>Confirm</span>
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>
  )
}

export default Split
