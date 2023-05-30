import { useToast } from '@/components/UI/Toast/use-toast'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import { Platforms, PledgeRead } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { getCentsInDollarString } from 'polarkit/utils'
import { useEffect, useState } from 'react'

export const useJustPledged = (
  orgId: string,
  repoId: string,
  issueId: string,
  check: boolean | undefined = true,
): PledgeRead | null => {
  const router = useRouter()
  const { toast } = useToast()
  const [pledge, setPledge] = useState<PledgeRead | null>(null)
  const lastPledge = useStore((store) => store.lastPledge)

  useEffect(() => {
    if (!check || !lastPledge) return

    const isMatch =
      lastPledge &&
      lastPledge.orgId === orgId &&
      lastPledge.repoId === repoId &&
      lastPledge.issueId === issueId

    if (!isMatch) return

    const fetchPledge = () => {
      const request = api.pledges.getPledgeWithResources({
        platform: Platforms.GITHUB,
        orgName: lastPledge.orgName,
        repoName: lastPledge.repoName,
        number: lastPledge.issueNumber,
        pledgeId: lastPledge.pledgeId,
        include: '',
      })

      request.then((response) => {
        // TODO: Better error handling
        if (!response.pledge || lastPledge.redirectStatus !== 'succeeded')
          return

        const pledge: PledgeRead = response.pledge
        const issueName = `${lastPledge.orgName}/${lastPledge.repoName}#${lastPledge.issueNumber}`
        const amount = getCentsInDollarString(pledge.amount)
        toast({
          title: `You successfully pledged $${amount}`,
          description: `Thanks for backing ${issueName}`,
        })
        setPledge(pledge)
      })
      return request
    }

    fetchPledge()
  }, [orgId, repoId, issueId, check, lastPledge, toast])
  return pledge
}
