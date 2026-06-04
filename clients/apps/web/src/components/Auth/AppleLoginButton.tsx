import { useAuthSessionStart } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { useToast } from '@/components/Toast/use-toast'
import Apple from '@mui/icons-material/Apple'
import { schemas } from '@polar-sh/client'
import { Button, type ButtonProps } from '@polar-sh/orbit'
import { getAppleAuthorizeURL } from '@/utils/auth'

interface AppleLoginButtonProps {
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  signup?: boolean
  variant?: ButtonProps['variant']
}

const AppleLoginButton = ({
  authenticationSession,
  returnTo,
  signup,
  variant,
}: AppleLoginButtonProps) => {
  const posthog = usePostHog()
  const authSessionStart = useAuthSessionStart()
  const { toast } = useToast()

  const onClick = async () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }
    posthog.capture(eventName, {
      method: 'apple',
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
    window.location.href = getAppleAuthorizeURL()
  }

  return (
    <a onClick={onClick}>
      <Button
        variant={variant}
        wrapperClassNames="space-x-2 p-2.5 px-5"
        fullWidth
      >
        <Apple />
        <div className="w-32 text-left">
          {signup ? 'Sign up with Apple' : 'Sign in with Apple'}
        </div>
      </Button>
    </a>
  )
}

export default AppleLoginButton
