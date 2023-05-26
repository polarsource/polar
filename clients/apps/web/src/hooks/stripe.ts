import { useToast } from '@/components/UI/Toast/use-toast'
import { useRouter, type NextRouter } from 'next/router'
import { api } from 'polarkit/api'
import { Platforms, PledgeRead } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/utils'
import { useEffect, useState } from 'react'

interface Params {
  pledgeID: string
  pledgeOrgName: string
  pledgeRepoName: string
  pledgeIssueNumber: number
  paymentIntentID: string
  redirectStatus: string
}

const cleanupURL = (router: NextRouter) => {
  const url = new URL(window.location.href)
  url.searchParams.delete('pledge_id')
  url.searchParams.delete('pledge_org_name')
  url.searchParams.delete('pledge_repo_name')
  url.searchParams.delete('pledge_issue_number')
  url.searchParams.delete('payment_intent_id')
  url.searchParams.delete('redirect_status')
  url.searchParams.delete('payment_intent_client_secret')

  // router.push even with options.shallow = true will create problems. Going vanilla.
  window.history.pushState({}, '', url.toString())
}

const getMatchedParams = (
  orgName: string,
  repoName: string,
  issueNumber: number,
): Params | false => {
  const url = new URL(window.location.href)
  const pledgeID = url.searchParams.get('pledge_id')
  const pledgeOrgName = url.searchParams.get('pledge_org_name')
  const pledgeRepoName = url.searchParams.get('pledge_repo_name')
  const queryIssueNumber = url.searchParams.get('pledge_issue_number')
  const paymentIntentID = url.searchParams.get('payment_intent_id')
  const redirectStatus = url.searchParams.get('redirect_status')

  const hasAllParams =
    pledgeOrgName &&
    pledgeRepoName &&
    queryIssueNumber &&
    pledgeID &&
    paymentIntentID &&
    redirectStatus

  if (!hasAllParams) return false

  const pledgeIssueNumber = parseInt(queryIssueNumber)

  const isMatch =
    pledgeOrgName === orgName &&
    pledgeRepoName === repoName &&
    pledgeIssueNumber === issueNumber

  if (!isMatch) return false

  return {
    pledgeID,
    pledgeOrgName,
    pledgeRepoName,
    pledgeIssueNumber,
    paymentIntentID,
    redirectStatus,
  }
}

export const useJustPledged = (
  orgName: string,
  repoName: string,
  issueNumber: number,
  check: boolean | undefined = true,
) => {
  const router = useRouter()
  const { toast } = useToast()
  const [pledge, setPledge] = useState<PledgeRead | null>(null)

  useEffect(() => {
    if (!check) return

    const params = getMatchedParams(orgName, repoName, issueNumber)
    if (!params) return

    const fetchPledge = (params: Params) => {
      const request = api.pledges.getPledgeWithResources({
        platform: Platforms.GITHUB,
        orgName: params.pledgeOrgName,
        repoName: params.pledgeRepoName,
        number: params.pledgeIssueNumber,
        pledgeId: params.pledgeID,
        include: '',
      })

      request.then((response) => {
        // TODO: Better error handling
        if (!response.pledge || params.redirectStatus !== 'succeeded') return

        const pledge: PledgeRead = response.pledge
        const issueName = `${params.pledgeOrgName}/${params.pledgeRepoName}#${params.pledgeIssueNumber}`
        const amount = getCentsInDollarString(pledge.amount)
        toast({
          title: `You successfully pledged $${amount}`,
          description: `Thanks for backing ${issueName}`,
        })
        setPledge(pledge)
      })
      return request
    }

    cleanupURL(router)
    fetchPledge(params)
  }, [check, router, toast, orgName, repoName, issueNumber])
  return { pledge }
}
