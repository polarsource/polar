import { useAuthSessionStart } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { useToast } from '@/components/Toast/use-toast'
import { getPublicServerURL } from '@/utils/api'
import GitHub from '@mui/icons-material/GitHub'
import { schemas } from '@polar-sh/client'
import Button, { type ButtonProps } from '@polar-sh/ui/components/atoms/Button'

interface GitHubLoginButtonProps {
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  signup?: boolean
  variant?: ButtonProps['variant']
}

const GitHubLoginButton = ({
  authenticationSession,
  returnTo,
  signup,
  variant,
}: GitHubLoginButtonProps) => {
  const posthog = usePostHog()
  const authSessionStart = useAuthSessionStart()
  const { toast } = useToast()

  const onClick = async () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }
    posthog.capture(eventName, {
      method: 'github',
    })

    if (!authenticationSession) {
      try {
        await authSessionStart.mutateAsync(returnTo)
      } catch {
        toast({
          title: 'Sign in failed',
          description:
            'Could not start authentication session. Please try again.',
        })
        return
      }
    }
    window.location.href = `${getPublicServerURL()}/v1/auth/github/authorize`
  }

  return (
    <a onClick={onClick}>
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
    </a>
  )
}

export default GitHubLoginButton
