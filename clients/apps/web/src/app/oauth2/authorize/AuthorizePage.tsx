import LogoType from '@/components/Brand/LogoType'
import { getServerURL } from '@/utils/api'
import { AddOutlined } from '@mui/icons-material'
import {
  AuthorizeOrganization,
  AuthorizeResponseOrganization,
  AuthorizeResponseUser,
  AuthorizeUser,
  Scope,
} from '@polar-sh/sdk'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'

const isSubTypeOrganization = (
  sub_type: string,
  _sub: AuthorizeUser | AuthorizeOrganization,
): _sub is AuthorizeOrganization => sub_type === 'organization'

const isSubTypeUser = (
  sub_type: string,
  _sub: AuthorizeUser | AuthorizeOrganization,
): _sub is AuthorizeUser => sub_type === 'user'

const AuthorizePage = ({
  authorizeResponse: { client, scopes, sub_type, sub },
  scopeDisplayNames,
  searchParams,
}: {
  authorizeResponse: AuthorizeResponseUser | AuthorizeResponseOrganization
  scopeDisplayNames: Record<Scope, string>
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/v1/oauth2/consent?${serializedSearchParams}`

  const clientName = client.client_name || client.client_id
  const hasTerms = client.policy_uri || client.tos_uri

  return (
    <form method="post" action={actionURL}>
      <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
        <div id="polar-bg-gradient"></div>
        <div className="flex w-80 flex-col items-center gap-6">
          <div className="flex flex-row items-center gap-2">
            <LogoType className="h-10" />
            <AddOutlined className="h-5" />
            {client.logo_uri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_uri} className="h-10" alt={clientName} />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                {clientName[0].toUpperCase()}
              </div>
            )}
          </div>
          {sub && isSubTypeOrganization(sub_type, sub) && (
            <>
              <div className="w-full text-center">
                <span className="font-medium">{clientName}</span> wants to
                access one of your Polar&apos;s organization.
              </div>
              <div className="flex w-full flex-row items-center justify-center gap-2 text-sm">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={sub.avatar_url}
                  name={sub.slug}
                />
                {sub.slug}
              </div>
            </>
          )}
          {sub && isSubTypeUser(sub_type, sub) && (
            <>
              <div className="w-full text-center">
                <span className="font-medium">{clientName}</span> wants to
                access your personal Polar account.
              </div>
              <div className="flex w-full flex-row items-center justify-center gap-2 text-sm">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={sub.avatar_url}
                  name={sub.username}
                />
                {sub.username}
              </div>
            </>
          )}
          <div className="w-full text-center">
            They&apos;ll be able to do the following:
          </div>
          <div className="max-h-96 w-full overflow-y-auto">
            <List size="small">
              {scopes.sort().map((scope) => (
                <ListItem key={scope} className="text-sm" size="small">
                  <span>{scopeDisplayNames[scope]}</span>
                </ListItem>
              ))}
            </List>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="grow"
              type="submit"
              name="action"
              value="deny"
            >
              Deny
            </Button>

            <Button className="grow" type="submit" name="action" value="allow">
              Allow
            </Button>
          </div>
          {hasTerms && (
            <div className="mt-8 text-center text-sm text-gray-500">
              Before using this app, you can review {clientName}&apos;s{' '}
              {client.tos_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.tos_uri}
                >
                  Terms of Service
                </a>
              )}
              {client.tos_uri && client.policy_uri && ' and '}
              {client.policy_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.policy_uri}
                >
                  Privacy Policy
                </a>
              )}
              .
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

export default AuthorizePage
