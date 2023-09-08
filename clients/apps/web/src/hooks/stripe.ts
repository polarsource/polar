import { useToast } from '@/components/Toast/use-toast'
import { api } from 'polarkit/api'
import { Pledge, PledgeState } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { useStore } from 'polarkit/store'
import { useEffect, useState } from 'react'

export const useToastLatestPledged = (
  orgId: string,
  repoId: string,
  issueId: string,
  check: boolean | undefined = true,
): Pledge | null => {
  const { toast } = useToast()
  const [pledge, setPledge] = useState<Pledge | null>(null)
  const latestPledge = useStore((store) => store.latestPledge)
  const latestPledgeShown = useStore((store) => store.latestPledgeShown)
  const setLatestPledgeShown = useStore((store) => store.setLatestPledgeShown)

  useEffect(() => {
    if (!check || !latestPledge || latestPledgeShown) return

    const isMatch =
      latestPledge &&
      latestPledge.pledge.issue.repository.organization.id === orgId &&
      latestPledge.pledge.issue.repository.id === repoId &&
      latestPledge.pledge.issue.id === issueId

    if (!isMatch) return

    const fetchLatestData = () => {
      const request = api.pledges.get({ id: latestPledge.pledge.id })

      request.then((pledge) => {
        // TODO: Better error handling
        const successful =
          latestPledge.redirectStatus === 'succeeded' ||
          pledge.state === PledgeState.CREATED

        if (!successful) {
          return
        }

        // const pledge: PledgeRead = response.pledge
        const issueName = `${pledge.issue.repository.organization.name}/${pledge.issue.repository.name}#${pledge.issue.number}`
        const amount = getCentsInDollarString(pledge.amount.amount)
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
