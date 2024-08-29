import { OpenAPIV3_1 } from 'openapi-types'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import AnchoredElement from './AnchoredElement'

export const AuthenticationSchema = ({
  operation,
}: {
  operation: OpenAPIV3_1.OperationObject
}) => {
  const hasOpenIdConnect = operation.security?.some(
    (security) => 'oidc' in security,
  )
  const hasPAT = operation.security?.some((security) => 'pat' in security)
  const scopes: string[] =
    operation.security?.find((security) => 'oidc' in security)?.['oidc'] || []

  if (!hasOpenIdConnect && !hasPAT && scopes.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="scopes">
        <h3 className="group text-xl text-black dark:text-white">
          Authentication
        </h3>
      </AnchoredElement>

      <List>
        <ListItem>
          <span className="font-medium">Methods</span>{' '}
          <div className="flex flex-row gap-2">
            {hasOpenIdConnect && (
              <div className="text-xxs rounded-md bg-gray-50 px-2 py-1 font-mono font-normal text-gray-500 dark:bg-gray-950/50 dark:text-gray-400">
                OpenID Connect
              </div>
            )}
            {hasPAT && (
              <div className="text-xxs rounded-md bg-gray-50 px-2 py-1 font-mono font-normal text-gray-500 dark:bg-gray-950/50 dark:text-gray-400">
                Personal Access Token
              </div>
            )}
          </div>
        </ListItem>
        {'x-polar-allowed-subjects' in operation && (
          <ListItem>
            <span className="font-medium">Subjects</span>{' '}
            <div className="flex flex-row gap-2">
              {(operation['x-polar-allowed-subjects'] as string[]).map(
                (subject) => (
                  <div
                    key={subject}
                    className="text-xxs rounded-md bg-gray-50 px-2 py-1 font-mono font-normal text-gray-500 dark:bg-gray-950/50 dark:text-gray-400"
                  >
                    {subject}
                  </div>
                ),
              )}
            </div>
          </ListItem>
        )}
        {scopes.length > 0 && (
          <ListItem>
            <span className="font-medium">Scopes</span>{' '}
            <div className="flex flex-row gap-2">
              {scopes.map((scope) => (
                <div
                  key={scope}
                  className="text-xxs rounded-md bg-gray-50 px-2 py-1 font-mono font-normal text-gray-500 dark:bg-gray-950/50 dark:text-gray-400"
                >
                  {scope}
                </div>
              ))}
            </div>
          </ListItem>
        )}
      </List>
    </div>
  )
}
