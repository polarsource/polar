import { useRouter } from 'next/router'
import type { OrganizationPrivateRead, Repository } from 'polarkit/api/client'
import { useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useEffect, useState } from 'react'
import { useRequireAuth } from './auth'

export const useCurrentOrgAndRepoFromURL = (): {
  org: OrganizationPrivateRead | undefined
  repo: Repository | undefined
  isLoaded: boolean
  haveOrgs: boolean
} => {
  const router = useRouter()
  const { organization: queryOrg, repo: queryRepo } = router.query
  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)
  const [org, setOrg] = useState<OrganizationPrivateRead | undefined>(undefined)
  const [repo, setRepo] = useState<Repository | undefined>(undefined)
  const [haveOrgs, setHaveOrgs] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)
  const setUserHaveOrgs = useStore((state) => state.setUserHaveOrgs)

  useEffect(() => {
    const orgSlug = typeof queryOrg === 'string' ? queryOrg : ''
    const repoSlug = typeof queryRepo === 'string' ? queryRepo : ''

    let nextOrg: OrganizationPrivateRead | undefined
    let nextRepo: Repository | undefined

    if (userOrgQuery.data) {
      nextOrg = userOrgQuery.data.find(
        (org: OrganizationPrivateRead) => org.name === orgSlug,
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

    // global stores
    setCurrentOrgRepo(nextOrg, nextRepo)
    setUserHaveOrgs(nextUserHaveOrgs)
  }, [userOrgQuery, setCurrentOrgRepo, setUserHaveOrgs, queryOrg, queryRepo])

  return {
    org,
    repo,
    isLoaded,
    haveOrgs,
  }
}
