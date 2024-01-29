'use client'

import {
  GitHubAuthUpsell,
  MaintainerUpsell,
} from '@/components/Dashboard/Upsell'
import { FeaturedCreators } from '@/components/Feed/FeaturedCreators'
import { Feed } from '@/components/Feed/Feed'
import { MySubscriptions } from '@/components/Feed/MySubscriptions'
import {
  useAuth,
  useCurrentOrgAndRepoFromURL,
  useGitHubAccount,
  usePersonalOrganization,
} from '@/hooks'
import { useListAdminOrganizations, useUserSubscriptions } from 'polarkit/hooks'

export default function Page() {
  const { currentUser } = useAuth()

  const userSubscriptions = useUserSubscriptions(
    currentUser?.id,
    undefined,
    9999,
  )

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = !githubAccount

  const personalOrg = usePersonalOrganization()
  const { org: currentOrg, isLoaded: isCurrentOrgLoaded } =
    useCurrentOrgAndRepoFromURL()
  const listOrganizationQuery = useListAdminOrganizations()

  const shouldShowMaintainerUpsell =
    isCurrentOrgLoaded &&
    !listOrganizationQuery.isLoading &&
    !currentOrg &&
    !personalOrg

  const subscriptionsToRender = userSubscriptions.data?.items ?? []

  return (
    <div className="relative flex h-full flex-col justify-between md:flex-row">
      <div className="flex w-full flex-col gap-y-8 pb-12 md:max-w-2xl md:pr-24">
        <Feed />
      </div>
      <div className="flex h-full w-full flex-col gap-y-12 self-stretch md:max-w-md md:pl-24">
        {shouldShowGitHubAuthUpsell && (
          <div className="-m-4 flex flex-col pt-4">
            <GitHubAuthUpsell />
          </div>
        )}
        {shouldShowMaintainerUpsell ? (
          <div className="-m-4 flex flex-col pt-4">
            <MaintainerUpsell />
          </div>
        ) : null}
        <FeaturedCreators />
        {subscriptionsToRender.length > 0 && (
          <MySubscriptions subscriptions={subscriptionsToRender} />
        )}
      </div>
    </div>
  )
}
