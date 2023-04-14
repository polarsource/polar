import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { OrganizationRead, RepositoryRead } from '../api/client'
import { useStore } from '../store'
import { requireAuth } from './auth'
import { useUserOrganizations } from './queries'

export const useCurrentOrgAndRepoFromURL = (): {
  org: OrganizationRead | undefined
  repo: RepositoryRead | undefined
  isLoaded: boolean
  haveOrgs: boolean
} => {
  const router = useRouter()
  const { organization: queryOrg, repo: queryRepo } = router.query
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)
  const [org, setOrg] = useState<OrganizationRead | undefined>(undefined)
  const [repo, setRepo] = useState<RepositoryRead | undefined>(undefined)
  const [haveOrgs, setHaveOrgs] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)
  const setUserHaveOrgs = useStore((state) => state.setUserHaveOrgs)

  useEffect(() => {
    const orgSlug = typeof queryOrg === 'string' ? queryOrg : ''
    const repoSlug = typeof queryRepo === 'string' ? queryRepo : ''

    let nextOrg: OrganizationRead | undefined
    let nextRepo: RepositoryRead | undefined

    if (userOrgQuery.data) {
      nextOrg = userOrgQuery.data.find(
        (org: OrganizationRead) => org.name === orgSlug,
      )
      if (nextOrg && repoSlug) {
        nextRepo = nextOrg.repositories?.find((r) => r.name === repoSlug)
      }
    }

    // local state
    setOrg(nextOrg)
    setRepo(nextRepo)

    setIsLoaded(userOrgQuery.isSuccess)

    const nextUserHaveOrgs = !!(
      userOrgQuery.data && userOrgQuery.data.length > 0
    )

    setHaveOrgs(nextUserHaveOrgs)

    console.log('set current org in hook', nextOrg?.name)

    // global stores
    setCurrentOrgRepo(nextOrg, nextRepo)
    setUserHaveOrgs(nextUserHaveOrgs)
  }, [userOrgQuery, setCurrentOrgRepo, setUserHaveOrgs])

  return {
    org,
    repo,
    isLoaded,
    haveOrgs,
  }
}
