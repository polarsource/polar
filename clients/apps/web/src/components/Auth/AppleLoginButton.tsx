import { usePostHog, type EventName } from '@/hooks/posthog'
import { getAppleAuthorizeURL } from '@/utils/auth'
import Apple from '@mui/icons-material/Apple'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

interface AppleLoginButtonProps {
  returnTo?: string
  signup?: schemas['UserSignupAttribution']
}

const AppleLoginButton = ({ returnTo, signup }: AppleLoginButtonProps) => {
  const posthog = usePostHog()

  const onClick = () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }

    posthog.capture(eventName, {
      method: 'apple',
    })
  }

  return (
    <Link
      href={getAppleAuthorizeURL({
        return_to: returnTo,
        attribution: JSON.stringify(signup),
      })}
      onClick={onClick}
    >
      <Button
        variant="secondary"
        wrapperClassNames="space-x-3 p-2.5 px-5"
        className="text-md p-5"
        fullWidth
      >
        <Apple />
        <div>Continue with Apple</div>
      </Button>
    </Link>
  )
}

export default AppleLoginButton
