import { UserSignupType } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
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
  const upgrade = async () => {
    const response = await api.users.maintainerUpgrade()
    // TODO: Change state instead to update - ideally - without refresh
    window.location.reload()
  }

  return (
    <Upsell
      title="Become a creator"
      description="Enable funding on your issues & reward your contributors"
    >
      <Button className="-z-1" fullWidth onClick={upgrade}>
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
