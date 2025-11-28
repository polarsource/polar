import LogoType from '@/components/Brand/LogoType'
import { getServerURL } from '@/utils/api'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'

const isSubTypeOrganization = (
  sub_type: string,
  _sub: schemas['AuthorizeUser'] | schemas['AuthorizeOrganization'],
): _sub is schemas['AuthorizeOrganization'] => sub_type === 'organization'

const isSubTypeUser = (
  sub_type: string,
  _sub: schemas['AuthorizeUser'] | schemas['AuthorizeOrganization'],
): _sub is schemas['AuthorizeUser'] => sub_type === 'user'

const groupScopes = (scopes: schemas['Scope'][]) => {
  return scopes.reduce<Record<string, schemas['Scope'][]>>((acc, scope) => {
    const key = scope.split(':')[0]
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(scope)
    return acc
  }, {})
}

const AuthorizePage = ({
  authorizeResponse: { client, scopes, sub_type, sub },
  scopeDisplayNames,
  searchParams,
}: {
  authorizeResponse:
    | schemas['AuthorizeResponseUser']
    | schemas['AuthorizeResponseOrganization']
  scopeDisplayNames: Record<schemas['Scope'], string>
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/v1/oauth2/consent?${serializedSearchParams}`

  const clientName = client.client_name || client.client_id
  const hasTerms = client.policy_uri || client.tos_uri

  return (
    <form method="post" action={actionURL}>
      <div className="dark:bg-polar-950 flex h-full min-h-screen w-full grow items-center justify-center bg-gray-50 py-12">
        <div id="polar-bg-gradient"></div>
        <div className="flex w-80 flex-col items-center gap-6">
          <div className="flex flex-row items-center gap-2">
            <LogoType className="h-10" />
            {client.logo_uri && (
              <>
                <AddOutlined className="h-5" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={client.logo_uri} className="h-10" alt={clientName} />
              </>
            )}
          </div>
          {sub && isSubTypeOrganization(sub_type, sub) && (
            <>
              <div className="w-full text-center">
                <span className="font-medium">{clientName}</span> wants to
                access one of your Polar organizations.
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
                  name={sub.email}
                />
                {sub.email}
              </div>
            </>
          )}
          <div className="w-full text-center">
            They&apos;ll be able to do the following:
          </div>
          <div className="w-full">
            <List size="small">
              {Object.entries(groupScopes(scopes)).map(([key, scopes]) => (
                <ListItem
                  key={key}
                  className="flex flex-col items-start gap-y-1 py-3 text-sm"
                  size="small"
                >
                  <h3 className="font-medium capitalize">
                    {key.replace('_', ' ')}
                  </h3>
                  <ul>
                    {scopes.map((scope) => (
                      <li
                        key={scope}
                        className="dark:text-polar-500 text-sm text-gray-500"
                      >
                        {scopeDisplayNames[scope]}
                      </li>
                    ))}
                  </ul>
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
