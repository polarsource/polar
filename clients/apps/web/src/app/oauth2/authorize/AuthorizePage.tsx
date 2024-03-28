import { AddOutlined } from '@mui/icons-material'
import { AuthorizeResponse } from '@polar-sh/sdk'
import { getServerURL } from 'polarkit/api'
import { LogoType } from 'polarkit/components/brand'
import Button from 'polarkit/components/ui/atoms/button'

const AuthorizePage = ({
  authorizeResponse: { client, scopes },
  searchParams,
}: {
  authorizeResponse: AuthorizeResponse
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/api/v1/oauth2/consent?${serializedSearchParams}`

  const clientName = client.client_metadata.client_name || client.client_id
  const hasTerms =
    client.client_metadata.policy_uri || client.client_metadata.tos_uri

  return (
    <form method="post" action={actionURL}>
      <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
        <div id="polar-bg-gradient"></div>
        <div className="flex w-80 flex-col items-center gap-6">
          <div className="flex flex-row items-center gap-2">
            <LogoType className="h-10" />
            <AddOutlined className="h-5" />
            {client.client_metadata.logo_uri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.client_metadata.logo_uri}
                className="h-10"
                alt={clientName}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                {clientName[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="w-full text-center">
            Authorize <span className="font-medium">{clientName}</span> to
            access your Polar account?
          </div>
          <div className="w-full text-center">
            They&apos;ll get access to the following data:
          </div>
          <div className="flex w-full flex-col gap-2">
            {scopes.map((scope) => (
              <div
                key={scope}
                className="w-full rounded-md border px-4 py-3 text-center font-mono text-sm"
              >
                {scope}
              </div>
            ))}
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
              {client.client_metadata.tos_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.client_metadata.tos_uri}
                >
                  Terms of Service
                </a>
              )}
              {client.client_metadata.tos_uri &&
                client.client_metadata.policy_uri &&
                ' and '}
              {client.client_metadata.policy_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.client_metadata.policy_uri}
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
