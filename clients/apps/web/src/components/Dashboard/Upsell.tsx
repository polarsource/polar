import { usePersonalOrganization } from '@/hooks'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CONFIG } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useMaintainerUpgrade } from 'polarkit/hooks'
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

  const upgrade = async () => {
    await maintainerUpgrade.mutateAsync()
    // TODO: Find a way to refresh the page using router.refresh() without keeping stale data
    window.location.reload()
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

export const CreatePostUpsell = () => {
  const personalOrg = usePersonalOrganization()

  if (!personalOrg) {
    return null
  }

  return (
    <Upsell
      title="Create your first post"
      description="Start building a community & newsletter by writing your first post. You can find inspiration from highlighted creators below."
    >
      <Link href={`/maintainer/${personalOrg.name}/posts/new`}>
        <Button size="sm" className="-z-1">
          <span>Write a Post</span>
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
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 flex flex-col gap-y-6 rounded-3xl bg-white p-6 shadow-2xl dark:border">
      <h3 className="dark:text-polar-50 font-medium text-gray-950">{title}</h3>
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
