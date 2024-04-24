import LogoType from '@/components/Brand/LogoType'
import { getServerURL } from '@/utils/api'
import { AddOutlined } from '@mui/icons-material'
import { AuthorizeResponseOrganization } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'

const OrganizationSelectionPage = ({
  authorizeResponse: { client, organizations },
  searchParams,
}: {
  authorizeResponse: AuthorizeResponseOrganization
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/api/v1/oauth2/consent?${serializedSearchParams}`

  const buildOrganizationSelectionURL = (organizationId: string) => {
    const serializedSearchParams = new URLSearchParams({
      ...searchParams,
      sub: organizationId,
    }).toString()
    return `?${serializedSearchParams}`
  }

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
            <span className="font-medium">{clientName}</span> wants to access
            one of your Polar&apos;s organization.
          </div>
          <div className="w-full text-center">
            Select one of your organization:
          </div>
          <div className="flex w-full flex-col gap-2">
            {organizations.map((organization) => (
              <Link
                key={organization.id}
                href={buildOrganizationSelectionURL(organization.id)}
              >
                <div className="hover:bg-polar-600 flex w-full flex-row items-center gap-2 rounded-md border px-4 py-3 text-sm transition-colors">
                  <Avatar
                    className="h-8 w-8"
                    avatar_url={organization.avatar_url}
                    name={organization.name}
                  />
                  {organization.name}
                </div>
              </Link>
            ))}
          </div>
          <div className="grid w-full">
            <Button
              variant="outline"
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

export default OrganizationSelectionPage
