'use client'

import {
  useAuth,
  useDisconnectOAuthAccount,
  useGitHubAccount,
  useGoogleAccount,
} from '@/hooks'
import { getGitHubAuthorizeURL, getGoogleAuthorizeURL } from '@/utils/auth'
import AlternateEmailOutlined from '@mui/icons-material/AlternateEmailOutlined'
import GitHub from '@mui/icons-material/GitHub'
import Google from '@mui/icons-material/Google'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
      <div>{icon}</div>
      <div className="grow">
        <div className="font-medium">{title}</div>
        <div className="dark:text-polar-500 text-sm text-gray-500">
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
  onDisconnect: () => void
  isDisconnecting: boolean
}

const GitHubAuthenticationMethod: React.FC<GitHubAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
  onDisconnect,
  isDisconnecting,
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
          {oauthAccount ? (
            <Button
              variant="secondary"
              onClick={onDisconnect}
              loading={isDisconnecting}
            >
              Disconnect
            </Button>
          ) : (
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
  onDisconnect: () => void
  isDisconnecting: boolean
}

const GoogleAuthenticationMethod: React.FC<GoogleAuthenticationMethodProps> = ({
  oauthAccount,
  returnTo,
  onDisconnect,
  isDisconnecting,
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
          {oauthAccount ? (
            <Button
              variant="secondary"
              onClick={onDisconnect}
              loading={isDisconnecting}
            >
              Disconnect
            </Button>
          ) : (
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
  const disconnectOAuth = useDisconnectOAuthAccount()

  const searchParams = useSearchParams()
  const [updateEmailStage, setUpdateEmailStage] = useState<
    'off' | 'form' | 'request' | 'verified'
  >((searchParams.get('update_email') as 'verified' | null) || 'off')
  const [userReloaded, setUserReloaded] = useState(false)

  useEffect(() => {
    if (!userReloaded && updateEmailStage === 'verified') {
      reloadUser()
      setUserReloaded(true)
    }
  }, [updateEmailStage, reloadUser, userReloaded])

  const updateEmailContent: Record<
    'off' | 'form' | 'request' | 'verified',
    React.ReactNode
  > = {
    off: (
      <div className="flex flex-row items-center gap-4">
        {currentUser && (
          <Button onClick={() => setUpdateEmailStage('form')}>
            Change Email
          </Button>
        )}
      </div>
    ),
    form: (
      <EmailUpdateForm
        onEmailUpdateRequest={() => setUpdateEmailStage('request')}
        onCancel={() => setUpdateEmailStage('off')}
        returnTo={`${pathname}?update_email=verified`}
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
  }

  return (
    <ShadowListGroup>
      <ShadowListGroup.Item>
        <GitHubAuthenticationMethod
          oauthAccount={githubAccount}
          returnTo={pathname || '/start'}
          onDisconnect={() => disconnectOAuth.mutate('github')}
          isDisconnecting={disconnectOAuth.isPending}
        />
      </ShadowListGroup.Item>

      <ShadowListGroup.Item>
        <GoogleAuthenticationMethod
          oauthAccount={googleAccount}
          returnTo={pathname || '/start'}
          onDisconnect={() => disconnectOAuth.mutate('google')}
          isDisconnecting={disconnectOAuth.isPending}
        />
      </ShadowListGroup.Item>

      <ShadowListGroup.Item>
        <AuthenticationMethod
          icon={<AlternateEmailOutlined />}
          title={currentUser?.email}
          subtitle="You can sign in with OTP codes sent to your email"
          action={updateEmailContent[updateEmailStage]}
        />
      </ShadowListGroup.Item>
    </ShadowListGroup>
  )
}

export default AuthenticationSettings
