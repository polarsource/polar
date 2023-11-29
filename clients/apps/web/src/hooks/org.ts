'use client'

import type { Organization, Repository } from '@polar-sh/sdk'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import {
  useListAdminOrganizations,
  useListAllOrganizations,
  useListRepositories,
} from 'polarkit/hooks'
import { useEffect, useState } from 'react'
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

  const listOrganizationsQuery = useListAllOrganizations()
  const listRepositoriesQuery = useListRepositories()

  const [org, setOrg] = useState<Organization | undefined>(undefined)
  const [repo, setRepo] = useState<Repository | undefined>(undefined)
  const [haveOrgs, setHaveOrgs] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const pathname = usePathname()

  useEffect(() => {
    let orgSlug = ''
    let repoSlug = ''

    if (typeof paramsOrg === 'string') {
      orgSlug = paramsOrg
    }

    // Repo slug form param or search
    // let repoSlug = ''
    if (typeof paramsRepo === 'string') {
      repoSlug = paramsRepo
    } else if (typeof searchRepo === 'string') {
      repoSlug = searchRepo
    }

    let nextOrg: Organization | undefined
    let nextRepo: Repository | undefined

    // Get repo and org
    if (orgSlug && repoSlug && listRepositoriesQuery.data?.items) {
      const repo = listRepositoriesQuery.data.items.find(
        (r) => r.name === repoSlug && r.organization?.name === orgSlug,
      )

      if (repo) {
        nextOrg = repo.organization
        nextRepo = repo
      }
    }

    // Get org if no org found above
    if (!nextOrg && orgSlug && listOrganizationsQuery.data?.items) {
      nextOrg = listOrganizationsQuery.data.items.find(
        (o) => o.name === orgSlug,
      )
    }

    // local state
    setOrg(nextOrg)
    setRepo(nextRepo)

    setIsLoaded(
      listOrganizationsQuery.isSuccess && listRepositoriesQuery.isSuccess,
    )

    const nextUserHaveOrgs = !!(
      listOrganizationsQuery.data?.items &&
      listOrganizationsQuery.data.items.length > 0
    )

    setHaveOrgs(nextUserHaveOrgs)
  }, [
    listOrganizationsQuery,
    listRepositoriesQuery,
    paramsOrg,
    paramsRepo,
    searchRepo,
    pathname,
  ])

  return {
    org,
    repo,
    isLoaded,
    haveOrgs,
  }
}

export const usePersonalOrganization = () => {
  const { currentUser } = useAuth()
  const listOrganizationsQuery = useListAdminOrganizations()

  return listOrganizationsQuery.data?.items?.find(
    (o) => o.name === currentUser?.username,
  )
}
