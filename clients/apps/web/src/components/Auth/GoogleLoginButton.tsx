import { usePostHog, type EventName } from '@/hooks/posthog'
import { getGoogleAuthorizeURL } from '@/utils/auth'
import { Google } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import { RawButton } from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

interface GoogleLoginButtonProps {
  returnTo?: string
  signup?: schemas['UserSignupAttribution']
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  returnTo,
  signup,
}) => {
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
    <RawButton variant="secondary" className="text-md w-full p-5" asChild>
      <Link
        href={getGoogleAuthorizeURL({
          return_to: returnTo,
          attribution: JSON.stringify(signup),
        })}
        onClick={onClick}
        className="space-x-3 p-2.5 px-5"
      >
        <Google aria-hidden="true" />
        <div>Continue with Google</div>
      </Link>
    </RawButton>
  )
}

export default GoogleLoginButton
