import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import SharedLayout from './components/SharedLayout'

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
  authorizeResponse: { client, scopes, sub_type, sub, scope_display_names },
  searchParams,
}: {
  authorizeResponse:
    | schemas['AuthorizeResponseUser']
    | schemas['AuthorizeResponseOrganization']
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/v1/oauth2/consent?${serializedSearchParams}`

  const clientName = client.client_name || client.client_id
  const hasTerms = client.policy_uri || client.tos_uri

  return (
    <SharedLayout
      client={client}
      introduction={
        <>
          {sub && isSubTypeOrganization(sub_type, sub) && (
            <>
              <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
                <span className="font-medium">{clientName}</span> requests the
                following permissions to your Polar organization.
              </div>
              <div className="dark:border-polar-700 dark:bg-polar-800 mt-6 mb-0 inline-flex flex-row items-center justify-start gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2 pr-4 text-sm">
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
              <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
                <span className="font-medium">{clientName}</span> requests the
                following permissions to your personal Polar account.
              </div>
              <div className="dark:border-polar-700 dark:bg-polar-800 mt-6 mb-0 inline-flex flex-row items-center justify-start gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2 pr-4 text-sm">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={sub.avatar_url}
                  name={sub.email}
                />
                {sub.email}
              </div>
            </>
          )}
        </>
      }
    >
      <form method="post" action={actionURL}>
        <div className="mb-6 w-full">
          <List size="small">
            {Object.entries(groupScopes(scopes)).map(([key, scopes]) => (
              <ListItem
                key={key}
                className="dark:bg-polar-800 dark:hover:bg-polar-800 flex flex-col items-start gap-y-1 bg-white py-3 text-sm hover:bg-white"
                size="small"
              >
                <h3 className="font-medium capitalize">
                  {key === 'openid' ? 'OpenID' : key.replace('_', ' ')}
                </h3>
                <ul>
                  {scopes.map((scope) => (
                    <li
                      key={scope}
                      className="dark:text-polar-500 text-sm text-gray-500"
                    >
                      {scope_display_names[scope]}
                    </li>
                  ))}
                </ul>
              </ListItem>
            ))}
          </List>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button className="grow" type="submit" name="action" value="allow">
            Allow
          </Button>
          <Button
            variant="secondary"
            className="grow"
            type="submit"
            name="action"
            value="deny"
          >
            Deny
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
      </form>
    </SharedLayout>
  )
}

export default AuthorizePage
