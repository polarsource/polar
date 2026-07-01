import { useToast } from '@/components/Toast/use-toast'
import { useOrgAuthSessionStart } from '@/hooks'
import { usePostHog } from '@/hooks/posthog'
import { getSSOAuthorizeLoginURL } from '@/utils/auth'
import Key from '@mui/icons-material/Key'
import { schemas } from '@polar-sh/client'
import { Button, type ButtonProps } from '@polar-sh/orbit'

interface SSOLoginButtonProps {
  organizationSlug: string
  connection: { id: string; name: string | null }
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  variant?: ButtonProps['variant']
}

const SSOLoginButton = ({
  organizationSlug,
  connection,
  authenticationSession,
  returnTo,
  variant,
}: SSOLoginButtonProps) => {
  const posthog = usePostHog()
  const authSessionStart = useOrgAuthSessionStart(organizationSlug)
  const { toast } = useToast()

  const onClick = async () => {
    posthog.capture('global:user:login:submit', { method: 'sso' })

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

    window.location.href = getSSOAuthorizeLoginURL(
      organizationSlug,
      connection.id,
    )
  }

  return (
    <a onClick={onClick}>
      <Button variant={variant} wrapperClassNames="space-x-2 p-2.5 px-5" fullWidth>
        <Key fontSize="small" />
        <div className="w-32 text-left">
          {connection.name ?? 'Sign in with SSO'}
        </div>
      </Button>
    </a>
  )
}

export default SSOLoginButton
