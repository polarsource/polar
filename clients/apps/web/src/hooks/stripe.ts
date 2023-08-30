import { useToast } from '@/components/Toast/use-toast'
import { api } from 'polarkit/api'
import { Platforms, PledgeRead } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { useStore } from 'polarkit/store'
import { useEffect, useState } from 'react'

export const useToastLatestPledged = (
  orgId: string,
  repoId: string,
  issueId: string,
  check: boolean | undefined = true,
): PledgeRead | null => {
  const { toast } = useToast()
  const [pledge, setPledge] = useState<PledgeRead | null>(null)
  const latestPledge = useStore((store) => store.latestPledge)
  const latestPledgeShown = useStore((store) => store.latestPledgeShown)
  const setLatestPledgeShown = useStore((store) => store.setLatestPledgeShown)

  useEffect(() => {
    if (!check || !latestPledge || latestPledgeShown) return

    const isMatch =
      latestPledge &&
      latestPledge.orgId === orgId &&
      latestPledge.repoId === repoId &&
      latestPledge.issueId === issueId

    if (!isMatch) return

    const fetchLatestData = () => {
      const request = api.pledges.getPledgeWithResources({
        platform: Platforms.GITHUB,
        orgName: latestPledge.orgName,
        repoName: latestPledge.repoName,
        number: latestPledge.issueNumber,
        pledgeId: latestPledge.pledge.id,
        include: '',
      })

      request.then((response) => {
        if (!response.pledge) return

        // TODO: Better error handling
        const successful =
          latestPledge.redirectStatus === 'succeeded' ||
          response.pledge.state === 'created'
        if (!successful) {
          return
        }

        const pledge: PledgeRead = response.pledge
        const issueName = `${latestPledge.orgName}/${latestPledge.repoName}#${latestPledge.issueNumber}`
        const amount = getCentsInDollarString(pledge.amount)
        toast({
          title: `You successfully pledged $${amount}`,
          description: `Thanks for backing ${issueName}`,
        })
        setPledge(pledge)
        setLatestPledgeShown(true)
      })
      return request
    }

    fetchLatestData()
  }, [
    orgId,
    repoId,
    issueId,
    check,
    latestPledge,
    toast,
    latestPledgeShown,
    setLatestPledgeShown,
  ])

  return pledge
}
