'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useDispute } from '@/hooks/queries/disputes'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Loader2 } from 'lucide-react'
import React from 'react'
import { DisputeDetailView } from './DisputeDetailView'

interface Props {
  organization: schemas['Organization']
  disputeId: string
}

const DisputeDetailPage = ({ organization, disputeId }: Props) => {
  const { data: dispute, isLoading } = useDispute(disputeId)

  if (isLoading) {
    return (
      <DashboardBody>
        <Box alignItems="center" justifyContent="center" paddingVertical="3xl">
          <Loader2 className="dark:text-polar-400 h-5 w-5 animate-spin text-gray-500" />
        </Box>
      </DashboardBody>
    )
  }

  if (!dispute) {
    return (
      <DashboardBody>
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          paddingVertical="3xl"
          rowGap="s"
          textAlign="center"
        >
          <Text variant="label">Dispute not found</Text>
          <Text color="muted">
            This dispute does not exist or you do not have access to it.
          </Text>
        </Box>
      </DashboardBody>
    )
  }

  return <DisputeDetailView organization={organization} dispute={dispute} />
}

export default DisputeDetailPage
