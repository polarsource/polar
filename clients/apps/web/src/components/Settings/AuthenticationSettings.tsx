import { useAuth, useGitHubAccount, useGoogleAccount } from '@/hooks'
import { getGitHubAuthorizeURL, getGoogleAuthorizeURL } from '@/utils/auth'
import { AlternateEmailOutlined, GitHub, Google } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import EmailUpdateForm from '../Form/EmailUpdateForm'

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
  oauthAccount: schemas['OAuthAccountRead'] | undefined
  returnTo: string
}

const GitHubAuthenticationMethod: React.FC<GitHubAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
}) => {
  const authorizeURL = getGitHubAuthorizeURL({ return_to: returnTo })

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
  oauthAccount: schemas['OAuthAccountRead'] | undefined
  returnTo: string
}

const GoogleAuthenticationMethod: React.FC<GoogleAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
}) => {
  const authorizeURL = getGoogleAuthorizeURL({ return_to: returnTo })

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
  const { currentUser, reloadUser } = useAuth()
  const pathname = usePathname()
  const githubAccount = useGitHubAccount()
  const googleAccount = useGoogleAccount()

  const searchParams = useSearchParams()
  const [updateEmailStage, setUpdateEmailStage] = useState<
    'off' | 'form' | 'request' | 'verified' | 'exists'
  >((searchParams.get('update_email') as 'verified' | null) || 'off')
  const [userReloaded, setUserReloaded] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!userReloaded && updateEmailStage === 'verified') {
      reloadUser()
      setUserReloaded(true)
    }
  }, [updateEmailStage, reloadUser, userReloaded])

  const updateEmailContent: Record<
    'off' | 'form' | 'request' | 'verified' | 'exists',
    React.ReactNode
  > = {
    off: (
      <div className="flex flex-row items-center gap-2">
        {currentUser && (
          <>
            <div className="text-sm">
              Connected{' '}
              <FormattedDateTime
                datetime={currentUser?.created_at}
                dateStyle="medium"
              />
            </div>
            <Button onClick={() => setUpdateEmailStage('form')}>
              Change email
            </Button>
          </>
        )}
      </div>
    ),
    form: (
      <EmailUpdateForm
        onEmailUpdateRequest={() => setUpdateEmailStage('request')}
        onEmailUpdateExists={() => setUpdateEmailStage('exists')}
        onEmailUpdateForm={() => setUpdateEmailStage('form')}
        setErr={setErrMsg}
      />
    ),
    request: (
      <div className="dark:text-polar-400 text-center text-sm text-gray-500">
        A verification email was sent to this address.
      </div>
    ),
    verified: (
      <div className="text-center text-sm text-green-700 dark:text-green-500">
        Your email has been updated!
      </div>
    ),
    exists: (
      <div className="text-center text-sm text-red-700 dark:text-red-500">
        {errMsg}
      </div>
    ),
  }

  return (
    <>
      {currentUser && (
        <ShadowListGroup>
          <ShadowListGroup.Item>
            <GitHubAuthenticationMethod
              oauthAccount={githubAccount}
              returnTo={pathname || '/start'}
            />
          </ShadowListGroup.Item>
          <ShadowListGroup.Item>
            <GoogleAuthenticationMethod
              oauthAccount={googleAccount}
              returnTo={pathname || '/start'}
            />
          </ShadowListGroup.Item>
          <ShadowListGroup.Item>
            <AuthenticationMethod
              icon={<AlternateEmailOutlined />}
              title={currentUser.email}
              subtitle="You can sign in with magic links sent to your email."
              action={updateEmailContent[updateEmailStage]}
            />
          </ShadowListGroup.Item>
        </ShadowListGroup>
      )}
    </>
  )
}

export default AuthenticationSettings
