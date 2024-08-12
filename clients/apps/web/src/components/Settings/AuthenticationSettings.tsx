import { useAuth, useGitHubAccount, useGoogleAccount } from '@/hooks'
import { getGitHubAuthorizeURL, getGoogleAuthorizeURL } from '@/utils/auth'
import { AlternateEmailOutlined, GitHub, Google } from '@mui/icons-material'
import { OAuthAccountRead } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'

interface AuthenticationMethodProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: React.ReactNode
  action: React.ReactNode
}

const AuthenticationMethod: React.FC<AuthenticationMethodProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => {
  return (
    <div className="flex flex-row items-center justify-center gap-5">
      <div>{icon}</div>
      <div className="grow">
        <div className="font-medium">{title}</div>
        <div className="dark:text-polar-400 text-sm text-gray-500">
          {subtitle}
        </div>
      </div>
      <div>{action}</div>
    </div>
  )
}

interface GitHubAuthenticationMethodProps {
  oauthAccount: OAuthAccountRead | undefined
  returnTo: string
}

const GitHubAuthenticationMethod: React.FC<GitHubAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
}) => {
  const authorizeURL = getGitHubAuthorizeURL({ returnTo })

  return (
    <AuthenticationMethod
      icon={<GitHub />}
      title={
        oauthAccount ? (
          <>
            {oauthAccount.account_username ? (
              <>
                {oauthAccount.account_username} ({oauthAccount.account_email})
              </>
            ) : (
              oauthAccount.account_email
            )}
          </>
        ) : (
          'Connect GitHub'
        )
      }
      subtitle={
        oauthAccount
          ? 'You can sign in with your GitHub account.'
          : 'Sync your profile and get a better experience.'
      }
      action={
        <>
          {oauthAccount && (
            <div className="text-sm">
              Connected{' '}
              <FormattedDateTime
                datetime={oauthAccount.created_at}
                dateStyle="medium"
              />
            </div>
          )}
          {!oauthAccount && (
            <Button asChild>
              <a href={authorizeURL}>Connect</a>
            </Button>
          )}
        </>
      }
    />
  )
}

interface GoogleAuthenticationMethodProps {
  oauthAccount: OAuthAccountRead | undefined
  returnTo: string
}

const GoogleAuthenticationMethod: React.FC<GoogleAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
}) => {
  const authorizeURL = getGoogleAuthorizeURL({ returnTo })

  return (
    <AuthenticationMethod
      icon={<Google />}
      title={oauthAccount ? oauthAccount.account_email : 'Connect Google'}
      subtitle={
        oauthAccount
          ? 'You can sign in with your Google account.'
          : 'Link your Google account for faster login.'
      }
      action={
        <>
          {oauthAccount && (
            <div className="text-sm">
              Connected{' '}
              <FormattedDateTime
                datetime={oauthAccount.created_at}
                dateStyle="medium"
              />
            </div>
          )}
          {!oauthAccount && (
            <Button asChild>
              <a href={authorizeURL}>Connect</a>
            </Button>
          )}
        </>
      }
    />
  )
}

const AuthenticationSettings = () => {
  const { currentUser } = useAuth()
  const pathname = usePathname()
  const githubAccount = useGitHubAccount()
  const googleAccount = useGoogleAccount()

  return (
    <>
      {currentUser && (
        <ShadowListGroup>
          <ShadowListGroup.Item>
            <GitHubAuthenticationMethod
              oauthAccount={githubAccount}
              returnTo={pathname || '/feed'}
            />
          </ShadowListGroup.Item>
          <ShadowListGroup.Item>
            <GoogleAuthenticationMethod
              oauthAccount={googleAccount}
              returnTo={pathname || '/feed'}
            />
          </ShadowListGroup.Item>
          <ShadowListGroup.Item>
            <AuthenticationMethod
              icon={<AlternateEmailOutlined />}
              title={currentUser.email}
              subtitle="You can sign in with magic links sent to your email."
              action={
                <div className="text-sm">
                  Connected{' '}
                  <FormattedDateTime
                    datetime={currentUser.created_at}
                    dateStyle="medium"
                  />
                </div>
              }
            />
          </ShadowListGroup.Item>
        </ShadowListGroup>
      )}
    </>
  )
}

export default AuthenticationSettings
