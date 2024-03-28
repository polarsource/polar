import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerURL } from 'polarkit/api'
import AuthorizeErrorPage from './AuthorizeErrorPage'
import AuthorizePage from './AuthorizePage'

const getAuthorizeResponse = async (
  searchParams: Record<string, string>,
): Promise<Response> => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  let url = `${getServerURL()}/api/v1/oauth2/authorize?${serializedSearchParams}`

  const cookieStore = cookies()
  return await fetch(url, {
    method: 'GET',
    credentials: 'include',
    redirect: 'manual',
    headers: {
      Cookie: cookieStore.toString(),
    },
  })
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  const response = await getAuthorizeResponse(searchParams)

  if (response.status >= 300 && response.status < 400) {
    redirect(response.headers.get('Location') ?? '/')
  }

  const data = await response.json()

  if (response.status === 400) {
    return (
      <AuthorizeErrorPage
        error={data.error}
        error_description={data.error_description}
        error_uri={data.error_uri}
      />
    )
  }

  if (response.ok) {
    return (
      <AuthorizePage authorizeResponse={data} searchParams={searchParams} />
    )
  }
}
