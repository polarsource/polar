import { getGoogleAuthorizeURL } from '@/utils/auth'
import { Google } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'

interface GoogleLoginButtonProps {
  returnTo?: string
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ returnTo }) => {
  return (
    <a href={getGoogleAuthorizeURL({ returnTo })}>
      <Button
        wrapperClassNames="space-x-3 p-2.5 px-5"
        className="text-md p-5"
        fullWidth
      >
        <Google />
        <div>Sign in with Google</div>
      </Button>
    </a>
  )
}

export default GoogleLoginButton
