import revalidate from '@/app/actions'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getAuthenticatedUser } from '@/utils/user'
import { Organization, ResponseError, ValidationError } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Get started', // " | Polar is added by the template"
  }
}

export default async function Page({
  searchParams: { slug, auto },
}: {
  searchParams: { slug?: string; auto?: string }
}) {
  let validationErrors: ValidationError[] = []
  let error: string | undefined = undefined

  // Create the organization automatically if the slug is provided and auto is true
  if (auto === 'true' && slug) {
    const api = getServerSideAPI()
    let organization: Organization | undefined = undefined
    try {
      organization = await api.organizations.create({
        body: {
          name: slug,
          slug,
        },
      })
    } catch (e) {
      // In case of error, pass it to the client
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          validationErrors = body['detail'] as ValidationError[]
        } else {
          error = e.message
        }
      }
    } finally {
      if (organization) {
        await revalidate(`organizations:${organization.id}`)
        await revalidate(`organizations:${organization.slug}`)
        const currentUser = await getAuthenticatedUser(api)
        await revalidate(`users:${currentUser?.id}:organizations`)
        return redirect(`/dashboard/${organization.slug}/onboarding`)
      }
    }
  }

  return (
    <ClientPage slug={slug} validationErrors={validationErrors} error={error} />
  )
}
