import { useAuth } from '@/hooks'
import { useRedirectToGitHubInstallation } from '@/hooks/github'
import { useListMemberOrganizations } from '@/hooks/queries'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Banner } from 'polarkit/components/ui/molecules'
import { PropsWithChildren } from 'react'
import GithubLoginButton from '../Auth/GithubLoginButton'

export const GitHubAuthUpsell = () => {
  const pathname = usePathname()
  return (
    <Upsell
      title="Connect with GitHub"
      description="Unlock more features by connecting your account with GitHub"
    >
      <GithubLoginButton
        className="border-none bg-blue-500 text-white hover:bg-blue-400 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:hover:text-white"
        text="Connect with GitHub"
        returnTo={pathname || '/feed'}
        userSignupType={UserSignupType.BACKER}
      />
    </Upsell>
  )
}

export const MaintainerUpsell = () => {
  const { currentUser } = useAuth()
  const router = useRouter()

  const upgrade = async () => {
    alert('CREATE ORG!')
    // TODO: Find a way to refresh the page using router.refresh() without keeping stale data
    router.push(`/maintainer/${currentUser?.username}/overview`)
  }

  return (
    <Upsell
      title="Become a creator"
      description="Build, engage & convert your own community of free- and paid subscribers."
    >
      <Button size="sm" className="-z-1 self-start" onClick={upgrade}>
        <span>Get Started</span>
        <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
      </Button>
    </Upsell>
  )
}

export const SetupProductsUpsell = () => {
  const organizations = useListMemberOrganizations()
  const firstOrg = organizations.data?.items?.[0]

  if (!firstOrg) {
    return null
  }

  return (
    <Upsell
      title="Create & Promote Products"
      description="Monetize your projects by selling digital products, subscriptions, and services to your community."
    >
      <Link href={`/maintainer/${firstOrg.slug}/products/overview`}>
        <Button size="sm" className="-z-1">
          <span>Get Started</span>
          <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
        </Button>
      </Link>
    </Upsell>
  )
}

export const Upsell = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) => {
  return (
    <div className="dark:border-polar-700 dark:text-polar-400 rounded-4xl dark:bg-polar-900 flex flex-col gap-y-6 bg-white p-6">
      <h3 className="text-lg font-medium text-gray-950 dark:text-white">
        {title}
      </h3>
      <p className="dark:text-polar-300 -mt-2 text-sm text-gray-500">
        {description}
      </p>
      {children}
    </div>
  )
}

export const GitHubAppInstallationUpsell = ({
  organization,
}: {
  organization: Organization
}) => {
  const redirectToGitHubInstallation =
    useRedirectToGitHubInstallation(organization)
  return (
    <>
      <Banner
        color="default"
        right={
          <Button size="sm" onClick={redirectToGitHubInstallation}>
            Install GitHub App
          </Button>
        }
      >
        <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
        <span className="text-sm">
          Install our <strong>GitHub App</strong> on at least one of your
          repositories to enable this feature.
        </span>
      </Banner>
    </>
  )
}
