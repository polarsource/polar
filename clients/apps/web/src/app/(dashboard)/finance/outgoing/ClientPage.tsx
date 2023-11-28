'use client'

import { useToast } from '@/components/Toast/use-toast'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useListAccountsByOrganization,
  useListPledgesForOrganization,
  useListRewards,
} from 'polarkit/hooks'

export default function ClientPage() {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const params = useSearchParams()
  const status = params?.get('status')

  const { toast } = useToast()

  const pledges = useListPledgesForOrganization(org?.platform, org?.name)
  const rewards = useListRewards(org?.id)
  const accounts = useListAccountsByOrganization(org?.id)

  return <></>
}
