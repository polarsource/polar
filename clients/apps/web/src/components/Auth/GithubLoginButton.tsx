import { usePostHog, type EventName } from '@/hooks/posthog'
import { getGitHubAuthorizeLoginURL } from '@/utils/auth'
import GitHub from '@mui/icons-material/GitHub'
import { schemas } from '@polar-sh/client'
import Button, { type ButtonProps } from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

interface GithubLoginButtonProps {
  returnTo?: string
  signup?: schemas['UserSignupAttribution']
  variant?: ButtonProps['variant']
}

const GithubLoginButton = ({
  returnTo,
  signup,
  variant,
}: GithubLoginButtonProps) => {
  const posthog = usePostHog()

  const onClick = () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }

    posthog.capture(eventName, {
      method: 'github',
    })
  }

  return (
    <Link
      href={getGitHubAuthorizeLoginURL({
        return_to: returnTo,
        attribution: JSON.stringify(signup),
      })}
      onClick={onClick}
    >
      <Button
        variant={variant}
        wrapperClassNames="space-x-2 p-2.5 px-5"
        fullWidth
      >
        <GitHub />
        <div className="w-32 text-left">
          {signup ? 'Sign up with GitHub' : 'Sign in with GitHub'}
        </div>
      </Button>
    </Link>
  )
}

export default GithubLoginButton
