import { UserIcon } from '@heroicons/react/24/outline'
import { Organization } from '@polar-sh/sdk'
import { Input, Switch } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useMemo, useRef, useState } from 'react'

const PublicRewardsSetting = (props: {
  value: number | undefined
  org: Organization
  isIssue?: boolean
  onSave: (value: number | undefined) => void
}) => {
  const usePublicRewards = props.value !== null && props.value !== undefined
  const contributorsShare =
    props.value !== null && props.value !== undefined ? props.value : 50

  const maintainerShare = useMemo(() => {
    if (contributorsShare === undefined) {
      return 50
    }
    return 100 - contributorsShare
  }, [contributorsShare])

  const onSave = async (splitShare?: number) => {
    await props.onSave(splitShare)
  }

  const [bannerContributionRewardShown, setBannerContributionRewardShown] =
    useState(false)

  const [bannerContributionUpdated, setBannerContributionUpdated] =
    useState(false)
  const [bannerContributionUpdatedValue, setBannerContributionUpdatedValue] =
    useState(0)

  const [bannerContributionRewardHidden, setBannerContributionRewardHidden] =
    useState(false)

  type Timeout = ReturnType<typeof setTimeout>
  const bannerTimeout = useRef<Timeout | null>(null)

  const onCheckedChange = (checked: boolean) => {
    onSave(checked ? contributorsShare : undefined)

    if (checked) {
      setBannerContributionRewardShown(true)
      setBannerContributionRewardHidden(false)

      bannerTimeout.current && clearTimeout(bannerTimeout.current)
      bannerTimeout.current = setTimeout(() => {
        setBannerContributionRewardShown(false)
      }, 2000)
    } else {
      setBannerContributionRewardHidden(true)
      setBannerContributionRewardShown(false)

      bannerTimeout.current && clearTimeout(bannerTimeout.current)
      bannerTimeout.current = setTimeout(() => {
        setBannerContributionRewardHidden(false)
      }, 2000)
    }
  }

  const contributorShareUpdated = (val: number) => {
    onSave(val)
    setBannerContributionUpdatedValue(val)
    setBannerContributionUpdated(true)

    bannerTimeout.current && clearTimeout(bannerTimeout.current)
    bannerTimeout.current = setTimeout(() => {
      setBannerContributionUpdated(false)
    }, 2000)
  }

  return (
    <>
      <div className="flex w-full flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="dark:text-polar-100 text-sm font-medium text-gray-900">
              Public rewards
            </div>
            <div className="dark:text-polar-400 mt-1 text-xs text-gray-600">
              Public & upfront rewards can attract contributors. You can also
              reward & adjust splits later too.
            </div>
          </div>

          <div>
            {/*
              We currently don't support opting out a single issue from upfront splits if the organization has it enabled by default. 
              Disabling the switch if we're in issue mode and it's forced on by the org.

              Users can "disable" rewards by explicitly setting the share to 0.
            */}
            <Switch
              checked={usePublicRewards}
              onCheckedChange={onCheckedChange}
              disabled={
                usePublicRewards &&
                props.isIssue &&
                props.org.default_upfront_split_to_contributors !== undefined
              }
            />
          </div>
        </div>

        {usePublicRewards && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="dark:bg-polar-600 h-6 w-6 rounded-full bg-gray-100 p-1" />
                <div className="dark:text-polar-100 text-sm">
                  Reserved for contributor(s)
                </div>
              </div>
              <div className="flex w-[120px] items-center gap-3 py-2">
                <span className="dark:text-polar-400 flex-shrink-0 text-gray-500">
                  %
                </span>
                <div className="flex-1">
                  <Input
                    className={
                      usePublicRewards
                        ? 'dark:text-polar-100 font-medium text-black'
                        : 'dark:text-polar-400 text-gray-500'
                    }
                    disabled={!usePublicRewards}
                    value={contributorsShare}
                    placeholder={'50'}
                    onChange={(e) => {
                      let val = parseInt(e.target.value)
                      val = Math.min(Math.max(val, 0), 100)
                      if (isNaN(val)) {
                        val = 0
                      }
                      contributorShareUpdated(val)
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="dark:text-polar-100 flex items-center gap-2 text-sm">
                <img
                  src={props.org.avatar_url}
                  className="h-6 w-6 rounded-full"
                />
                <div>{props.org.pretty_name || props.org.name}</div>
                <div className="dark:text-polar-400 text-gray-500">
                  Reviews, feedback & maintenance. Reward yourself too.
                </div>
              </div>
              <div className="flex w-[120px] items-center gap-3 py-2">
                <span className="dark:text-polar-400 flex-shrink-0 text-gray-500">
                  %
                </span>
                <div className="flex-1">
                  <Input disabled value={maintainerShare} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {bannerContributionRewardShown && (
        <Banner color="blue">
          Contributor reward is now shown in the Polar badge
        </Banner>
      )}

      {bannerContributionRewardHidden && (
        <Banner color="blue">
          Contributor reward is now hidden from the Polar badge
        </Banner>
      )}

      {bannerContributionUpdated && (
        <Banner color="blue">
          Contributor reward has been updated to{' '}
          <strong>{bannerContributionUpdatedValue}%</strong>
        </Banner>
      )}
    </>
  )
}

export default PublicRewardsSetting
