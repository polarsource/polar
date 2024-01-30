import { useAuth } from '@/hooks'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CONFIG } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useMaintainerUpgrade } from 'polarkit/hooks'
import { PropsWithChildren } from 'react'
import GithubLoginButton from '../Shared/GithubLoginButton'

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

  const maintainerUpgrade = useMaintainerUpgrade()

  const upgrade = async () => {
    await maintainerUpgrade.mutateAsync()
    router.push(`/maintainer/${currentUser?.username}/overview`)
  }

  return (
    <Upsell
      title="Become a creator"
      description="Build, engage & convert your own community of free- and paid subscribers."
    >
      <Button
        className="-z-1"
        fullWidth
        onClick={upgrade}
        loading={maintainerUpgrade.isPending}
      >
        Get Started
      </Button>
    </Upsell>
  )
}

export const Upsell = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 mx-4 flex flex-col gap-y-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm">
      <h3 className="dark:text-polar-50 font-medium text-blue-500">{title}</h3>
      <p className="dark:text-polar-300 -mt-2 text-blue-400">{description}</p>
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
