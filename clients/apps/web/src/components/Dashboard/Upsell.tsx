import { useAuth, usePersonalOrganization } from '@/hooks'
import { useMaintainerUpgrade } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { UserSignupType } from '@polar-sh/sdk'
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
  const maintainerUpgrade = useMaintainerUpgrade()
  const { currentUser } = useAuth()
  const router = useRouter()

  const upgrade = async () => {
    await maintainerUpgrade.mutateAsync()
    // TODO: Find a way to refresh the page using router.refresh() without keeping stale data
    router.push(`/maintainer/${currentUser?.username}/overview`)
  }

  return (
    <Upsell
      title="Become a creator"
      description="Build, engage & convert your own community of free- and paid subscribers."
    >
      <Button
        size="sm"
        className="-z-1 self-start"
        onClick={upgrade}
        loading={maintainerUpgrade.isPending}
      >
        <span>Get Started</span>
        <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
      </Button>
    </Upsell>
  )
}

export const SetupProductsUpsell = () => {
  const personalOrg = usePersonalOrganization()

  if (!personalOrg) {
    return null
  }

  return (
    <Upsell
      title="Create & Promote Products"
      description="Monetize your projects by selling digital products, subscriptions, and services to your community."
    >
      <Link href={`/maintainer/${personalOrg.name}/products/overview`}>
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
    <div className="dark:border-polar-700 dark:text-polar-400 bg-gray-75 flex flex-col gap-y-6 rounded-3xl p-6 dark:border dark:bg-transparent">
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

export const GitHubAppInstallationUpsell = () => {
  return (
    <>
      <Banner
        color="default"
        right={
          <Link href={CONFIG.GITHUB_INSTALLATION_URL}>
            <Button size="sm">Install GitHub App</Button>
          </Link>
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
