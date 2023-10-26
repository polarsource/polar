import { useGitHubAccount, useRequireAuth } from '@/hooks'
import { AtSymbolIcon } from '@heroicons/react/24/solid'
import { OAuthAccountRead, UserRead } from '@polar-sh/sdk'
import { api } from 'polarkit'
import {
  Button,
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import { useCallback, useState } from 'react'

interface AuthenticationMethodProps {
  icon: React.ReactNode
  title: string
  subtitle: string
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
  user: UserRead
  oauthAccount: OAuthAccountRead | undefined
  gotoUrl: string
}

const GitHubAuthenticationMethod: React.FC<GitHubAuthenticationMethodProps> = ({
  user,
  oauthAccount,
  gotoUrl,
}) => {
  const [loading, setLoading] = useState(false)
  const connect = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.integrations.githubAuthorize({ gotoUrl })
      if (res.authorization_url) {
        window.location.href = res.authorization_url
      }
    } catch (err) {
      setLoading(false)
    }
  }, [gotoUrl])

  return (
    <AuthenticationMethod
      icon={
        <svg
          className="h-8 w-8"
          aria-hidden="true"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
            clipRule="evenodd"
          />
        </svg>
      }
      title={oauthAccount ? oauthAccount.account_email : 'Connect GitHub'}
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
            <Button onClick={connect} loading={loading} disabled={loading}>
              Connect
            </Button>
          )}
        </>
      }
    />
  )
}

const AuthenticationSettings = () => {
  const { currentUser } = useRequireAuth()
  const githubAccount = useGitHubAccount()

  return (
    <>
      {currentUser && (
        <ShadowListGroup>
          <ShadowListGroup.Item>
            <GitHubAuthenticationMethod
              user={currentUser}
              oauthAccount={githubAccount}
              gotoUrl={window.location.href}
            />
          </ShadowListGroup.Item>
          <ShadowListGroup.Item>
            <AuthenticationMethod
              icon={<AtSymbolIcon className="h-8 w-8" />}
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
