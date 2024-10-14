import { getGoogleAuthorizeURL } from '@/utils/auth'
import { Google } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import { UserSignupAttribution } from '@polar-sh/sdk'

interface GoogleLoginButtonProps {
  returnTo?: string
  signup?: UserSignupAttribution
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ returnTo, signup }) => {
  return (
    <a href={getGoogleAuthorizeURL({
      returnTo,
      attribution: JSON.stringify(signup)
    })}>
      <Button
        variant="secondary"
        wrapperClassNames="space-x-3 p-2.5 px-5"
        className="text-md p-5"
        fullWidth
      >
        <Google />
        <div>Continue with Google</div>
      </Button>
    </a>
  )
}

export default GoogleLoginButton
