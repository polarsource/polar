'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { Bolt } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useState } from 'react'
import EmptyLayout from '../Layout/EmptyLayout'

export interface EnableIssuesViewProps {
  organization: Organization
}

export const EnableIssuesView = ({ organization }: EnableIssuesViewProps) => {
  const [enablingIssues, setEnablingIssues] = useState(false)
  const updateOrganization = useUpdateOrganization()
  const router = useRouter()

  const enableIssues = async () => {
    setEnablingIssues(true)

    await updateOrganization
      .mutateAsync({
        id: organization.id,
        body: {
          feature_settings: {
            issue_funding_enabled: true,
          },
        },
      })
      .then(() => {
        router.refresh()
      })
      .catch(() => {
        setEnablingIssues(false)
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
        <Button loading={enablingIssues} onClick={enableIssues}>
          Enable Issues
        </Button>
      </div>
    </EmptyLayout>
  )
}
