import { useAuthSessionStart } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { getPublicServerURL } from '@/utils/api'
import Apple from '@mui/icons-material/Apple'
import { schemas } from '@polar-sh/client'
import Button, { type ButtonProps } from '@polar-sh/ui/components/atoms/Button'

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

  const onClick = async () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }
    posthog.capture(eventName, {
      method: 'apple',
    })

    if (!authenticationSession) {
      await authSessionStart.mutateAsync(returnTo)
    }
    window.location.href = `${getPublicServerURL()}/v1/auth/apple/authorize`
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
