import { getGoogleAuthorizeURL } from '@/utils/auth'
import { Google } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import { UserSignupAttribution } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePostHog, type EventName } from '@/hooks/posthog'

interface GoogleLoginButtonProps {
  returnTo?: string
  signup?: UserSignupAttribution
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ returnTo, signup }) => {
  const posthog = usePostHog()

  const onClick = () => {
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }

    posthog.capture(eventName, {
      method: 'google'
    })
  }

  return (
    <Link href={getGoogleAuthorizeURL({
      returnTo,
      attribution: JSON.stringify(signup)
    })} onClick={onClick}>
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
