'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { Bolt } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useRouter } from 'next/navigation'
import EmptyLayout from '../Layout/EmptyLayout'

export interface EnableIssuesViewProps {
  organization: schemas['Organization']
}

export const EnableIssuesView = ({ organization }: EnableIssuesViewProps) => {
  const updateOrganization = useUpdateOrganization()
  const router = useRouter()

  const enableIssues = async () => {
    await updateOrganization
      .mutateAsync({
        id: organization.id,
        body: {
          feature_settings: {
            issue_funding_enabled: true,
          },
          pledge_badge_show_amount: organization.pledge_badge_show_amount,
          pledge_minimum_amount: organization.pledge_minimum_amount,
        },
      })
      .then(() => {
        router.refresh()
      })
  }

  return (
    <EmptyLayout>
      <div className="dark:text-polar-500 flex flex-col items-center justify-center space-y-10 py-32 text-gray-500">
        <span className="text-6xl text-blue-400">
          <Bolt fontSize="inherit" />
        </span>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-medium text-gray-950 dark:text-white">
            Issues
          </h2>
          <h2 className="text-lg">
            Enable crowdfunding for your GitHub issues
          </h2>
        </div>
        <Button loading={updateOrganization.isPending} onClick={enableIssues}>
          Enable Issues
        </Button>
      </div>
    </EmptyLayout>
  )
}
