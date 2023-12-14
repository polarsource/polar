'use client'

import { RepositoriesOverivew } from '@/components/Organization/RepositoriesOverview'
import { Organization, Platforms } from '@polar-sh/sdk'
import { useSearchRepositories } from 'polarkit/hooks'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const { data: { items: repositories } = { items: [] }, isPending } =
    useSearchRepositories(Platforms.GITHUB, organization.name)

  return (
    <RepositoriesOverivew
      organization={organization}
      repositories={repositories ?? []}
      isLoading={isPending}
    />
  )
}

export default ClientPage
