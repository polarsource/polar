'use client'

import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { Organization, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import GithubLoginButton from '../Shared/GithubLoginButton'
import { ProfileMenu } from '../Shared/ProfileSelection'

interface OrganizationPublicPageNavProps {
  organization: Organization
}

export const OrganizationPublicPageNav = ({
  organization,
}: OrganizationPublicPageNavProps) => {
  const { currentUser } = useAuth()
  const pathname = usePathname()

  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const shouldRenderSubscriptionsTab = (subscriptionTiers?.length ?? 0) > 0

  return (
    <div className="flex flex-row items-center justify-between md:w-full">
      <TabsList className="dark:border-polar-700 hidden dark:border md:flex">
        <Link href={`/${organization.name}`}>
          <TabsTrigger value="overview" size="small">
            Overview
          </TabsTrigger>
        </Link>
        {isFeatureEnabled('subscriptions') && shouldRenderSubscriptionsTab && (
          <Link href={`/${organization.name}/subscriptions`}>
            <TabsTrigger value="subscriptions" size="small">
              Subscriptions
            </TabsTrigger>
          </Link>
        )}
        {isFeatureEnabled('subscriptions') && (
          <Link href={`/${organization.name}/benefits`}>
            <TabsTrigger value="benefits" size="small">
              Benefits
            </TabsTrigger>
          </Link>
        )}
        {isFeatureEnabled('feed') && (
          <Link href={`/${organization.name}/issues`}>
            <TabsTrigger value="issues" size="small">
              Issues
            </TabsTrigger>
          </Link>
        )}
        <Link href={`/${organization.name}/repositories`}>
          <TabsTrigger value="repositories" size="small">
            Repositories
          </TabsTrigger>
        </Link>
      </TabsList>
      {currentUser ? (
        <ProfileMenu className="z-50" />
      ) : (
        <GithubLoginButton
          userSignupType={UserSignupType.BACKER}
          posthogProps={{
            view: 'Maintainer Page',
          }}
          text="Sign in with GitHub"
          returnTo={pathname || '/feed'}
        />
      )}
    </div>
  )
}
