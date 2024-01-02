import { InformationCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { Issue, Pledge } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { PublicRewardPill } from 'polarkit/components/Issue'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { getCentsInDollarString } from 'polarkit/money'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
  is_suggested_from_contributions?: boolean
  is_maintainer_org?: boolean
}

const Split = (props: {
  issue: Issue
  pledges: Pledge[]
  contributors: Contributor[]
  shares: Share[]
  onConfirm: (shares: Share[]) => void
  onCancel: () => void
}) => {
  const [shares, setShares] = useState(props.shares)
  const [contributors, setContributors] = useState(props.contributors)

  useEffect(() => {
    setContributors(props.contributors)
  }, [props.contributors])

  const pledgeSum = props.pledges
    .map((p) => p.amount.amount)
    .reduce((a, b) => a + b, 0)

  const polarShare = pledgeSum * 0.1
  const pledgeSumToSplit = pledgeSum - polarShare

  const isFixed = (share: number | undefined): boolean => {
    return share !== undefined && !isNaN(share) && isFinite(share) && share >= 0
  }

  const upfrontSplit =
    props.issue.upfront_split_to_contributors ??
    props.issue.repository.organization.default_upfront_split_to_contributors

  const computedShares = useMemo(() => {
    const upfrontAdjustedShares = shares.map((s) => {
      const user = contributors.find((c) => c.username === s.username)

      if (!user?.is_maintainer_org) {
        return s
      }
      if (!upfrontSplit) {
        return s
      }
      if (s.share_thousands !== undefined || s.raw_value !== undefined) {
        return s
      }

      return {
        ...s,
        share_thousands: (100 - upfrontSplit) * 10,
      }
    })

    const fixedShares = upfrontAdjustedShares.filter((s) =>
      isFixed(s.share_thousands),
    )

    const fixedSharesSum = fixedShares
      .map((s) => s.share_thousands || 0)
      .reduce((a, b) => a + b, 0)

    const remainingUsersCount =
      upfrontAdjustedShares.length - fixedShares.length

    const deducedShare = (): number => {
      if (fixedSharesSum >= 1000) {
        return 0
      }
      return Math.floor((1000 - fixedSharesSum) / remainingUsersCount)
    }

    return upfrontAdjustedShares
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
          is_suggested_from_contributions:
            !!user?.is_suggested_from_contributions,
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
      is_suggested_from_contributions: boolean
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

  const [isLoading, setIsLoading] = useState(false)

  const onConfirm = () => {
    setIsLoading(true)
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
        lookupUserRequest: { username: searchGithubUsername },
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
        <div className="flex items-center gap-4">
          <div>Split reward (${getCentsInDollarString(pledgeSum)})</div>
          {upfrontSplit ? (
            <div className="w-fit">
              <PublicRewardPill percent={upfrontSplit} />
            </div>
          ) : null}
        </div>
      </ModalHeader>
      <div className="space-y-4 pt-4">
        <div className="flex flex-col gap-4 px-4">
          {computedShares.map((s, index) => (
            <div className="flex items-center space-x-4" key={index}>
              <div>
                <img src={s.avatar_url} className="h-6 w-6 rounded-full" />
              </div>
              <div className="dark:text-polar-200 flex flex-1 flex-col items-start text-gray-900">
                <span>{s.username}</span>
                {s.is_suggested_from_contributions && (
                  <div className="flex">
                    <span className="text-xs text-gray-500">
                      Suggested from linked PRs
                    </span>
                  </div>
                )}
              </div>

              <div className="dark:text-polar-400 text-gray-500">
                Est. $
                {getCentsInDollarString(
                  Math.round(s.est_amount * 100) / 100,
                  true,
                )}
              </div>
              <div className="flex w-[120px] items-center gap-2 py-2">
                <div className="flex-1">
                  <Input
                    postSlot="%"
                    className={twMerge(
                      'w-full',
                      s.is_fixed
                        ? 'dark:text-polar-100 font-medium text-black'
                        : 'dark:text-polar-400 text-gray-500',
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
                    className="hover:text-polar-600 dark:text-polar-300 h-6 w-6 flex-shrink-0 cursor-pointer text-gray-500"
                    onClick={() => onUpdate(s.username, '')}
                  />
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-row items-center justify-between">
            <form
              className="flex flex-row items-center space-x-4"
              onSubmit={onSearchGithubUsernameSubmit}
            >
              <button type="submit">
                <PlusIcon className="h-6 w-6" />
              </button>
              <Input
                placeholder="Add a GitHub user..."
                className="w-[240px]"
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
        <div className="bg-gray-75 dark:bg-polar-800 dark:text-polar-300 flex items-center px-4 py-2 text-gray-500">
          <InformationCircleIcon className="mr-2 h-6 w-6" />
          <div className="w-1-2 mr-4 flex-1 text-sm">
            Polar&apos;s fee of ${getCentsInDollarString(polarShare, true)} has
            been subtracted from the total
          </div>
          <div>
            <Button variant="ghost" className="mr-4" onClick={props.onCancel}>
              Cancel
            </Button>
          </div>
          <div>
            <Button
              disabled={!canSubmit}
              onClick={onConfirm}
              loading={isLoading}
            >
              <span>Confirm</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Split
