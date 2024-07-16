'use client'

import {
  useListMemberOrganizations,
  useListRepositories,
  useOrganizationBySlug,
} from '@/hooks/queries'
import type { Organization, Repository } from '@polar-sh/sdk'
import { useParams, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { useAuth } from '.'

export const useCurrentOrgAndRepoFromURL = (): {
  org: Organization | undefined
  repo: Repository | undefined
  isLoaded: boolean
  haveOrgs: boolean
} => {
  // org and repo from router params "/foo/[organization]/bar"
  const params = useParams()
  const paramsOrg = params?.organization
  const paramsRepo = params?.repo

  // repo can also be set as a query arg
  const search = useSearchParams()
  const searchRepo = search?.get('repo')

  const repositorySlug = useMemo(() => {
    if (typeof paramsRepo === 'string') {
      return paramsRepo
    } else if (typeof searchRepo === 'string') {
      return searchRepo
    }
  }, [paramsRepo, searchRepo])

  const { data: organizationBySlug, isSuccess: organizationIsSuccess } =
    useOrganizationBySlug(paramsOrg as string, !!paramsOrg)
  const { data: repositories, isSuccess: repositoryIsSuccess } =
    useListRepositories({
      organizationId: organizationBySlug?.id,
      name: repositorySlug,
    })
  const repo = repositories?.items?.[0]

  const isLoaded = useMemo(
    () => organizationIsSuccess && repositoryIsSuccess,
    [organizationIsSuccess, repositoryIsSuccess],
  )

  const listOrganizationsQuery = useListMemberOrganizations()
  const haveOrgs =
    listOrganizationsQuery.data?.items !== undefined &&
    listOrganizationsQuery.data.items.length > 0

  const org =
    organizationBySlug ||
    (listOrganizationsQuery && listOrganizationsQuery.data?.items?.[0])

  return {
    org,
    repo,
    isLoaded,
    haveOrgs,
  }
}

export const usePersonalOrganization = () => {
  const { currentUser } = useAuth()
  const listOrganizationsQuery = useListMemberOrganizations()

  return listOrganizationsQuery.data?.items?.find(
    (o) => o.name === currentUser?.username && o.is_personal,
  )
}

export const useIsOrganizationAdmin = (org?: Organization) => {
  const listOrganizationsQuery = useListMemberOrganizations()
  return listOrganizationsQuery.data?.items?.some((o) => o.id === org?.id)
}
