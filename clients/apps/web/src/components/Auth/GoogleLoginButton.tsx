import { usePostHog, type EventName } from '@/hooks/posthog'
import { getGoogleAuthorizeURL } from '@/utils/auth'
import Google from '@mui/icons-material/Google'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

interface GoogleLoginButtonProps {
  returnTo?: string
  signup?: schemas['UserSignupAttribution']
}

const GoogleLoginButton = ({ returnTo, signup }: GoogleLoginButtonProps) => {
  const posthog = usePostHog()

  const onClick = () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }

    posthog.capture(eventName, {
      method: 'google',
    })
  }

  return (
    <Link
      href={getGoogleAuthorizeURL({
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
        <Google />
        <div>Continue with Google</div>
      </Button>
    </Link>
  )
}

export default GoogleLoginButton
