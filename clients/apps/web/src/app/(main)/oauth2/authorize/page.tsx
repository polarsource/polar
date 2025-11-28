import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AuthorizeErrorPage from './AuthorizeErrorPage'
import AuthorizePage from './AuthorizePage'
import OrganizationSelectionPage from './OrganizationSelectionPage'
import { AuthorizeResponse } from './types'

const getAuthorizeResponse = async (
  searchParams: Record<string, string>,
): Promise<Response> => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const url = `${getServerURL()}/v1/oauth2/authorize?${serializedSearchParams}`

  const cookieStore = await cookies()
  return await fetch(url, {
    method: 'GET',
    credentials: 'include',
    redirect: 'manual',
    headers: {
      Cookie: cookieStore.toString(),
    },
  })
}

const getScopeDisplayNames = async (): Promise<
  Record<schemas['Scope'], string>
> => {
  const response = await fetch(`${getServerURL()}/openapi.json`)
  const openAPISchema = await response.json()
  return openAPISchema.components.schemas.Scope.enumNames
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string>>
}) {
  const searchParams = await props.searchParams
  const response = await getAuthorizeResponse(searchParams)

  if (response.status >= 300 && response.status < 400) {
    redirect(response.headers.get('Location') ?? '/')
  }

  if (response.status === 401) {
    const serializedSearchParams = new URLSearchParams({
      ...searchParams,
      // Avoid an infinite loop by changing the prompt to 'consent' if it was 'login'
      prompt: searchParams.prompt === 'login' ? 'consent' : searchParams.prompt,
    }).toString()
    const returnTo = `/oauth2/authorize?${serializedSearchParams}`
    const locationSearchParam = new URLSearchParams({
      return_to: returnTo,
    })

    if (searchParams.do_not_track) {
      locationSearchParam.set('do_not_track', searchParams.do_not_track)
    }
    const location = `/login?${locationSearchParam.toString()}`
    redirect(location)
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
    const { sub_type } = data as AuthorizeResponse
    if (sub_type === 'organization' && !searchParams['sub']) {
      return (
        <OrganizationSelectionPage
          authorizeResponse={data}
          searchParams={searchParams}
        />
      )
    } else {
      const scopeDisplayNames = await getScopeDisplayNames()
      return (
        <AuthorizePage
          authorizeResponse={data}
          scopeDisplayNames={scopeDisplayNames}
          searchParams={searchParams}
        />
      )
    }
  }
}
