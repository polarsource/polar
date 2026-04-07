import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import AIProductPage from './AIProductPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Create Product with AI',
  }
}

const isAssistantEnabled = Boolean(
  process.env.MCP_OAUTH2_CLIENT_ID &&
  process.env.MCP_OAUTH2_CLIENT_SECRET &&
  process.env.GRAM_API_KEY &&
  process.env.PYDANTIC_AI_GATEWAY_API_KEY,
)

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!isAssistantEnabled) {
    const { redirect } = await import('next/navigation')
    redirect(`/dashboard/${params.organization}/products/new`)
  }

  return <AIProductPage organization={organization} />
}
