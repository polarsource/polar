'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Layers } from 'lucide-react'
import { useContext, useMemo } from 'react'
import {
  shortVersion,
  versionLabel,
  versionLabels,
  VoidRequestError,
} from '../api'
import { configurationDiff, emptyConfiguration } from './diff'
import { useStage } from './queries'
import { StageChanges } from './StageChanges'

export const VoidStagePage = () => {
  const { organization } = useContext(OrganizationContext)
  return <StagePage key={organization.id} organizationId={organization.id} />
}

const StagePage = ({ organizationId }: { organizationId: string }) => {
  const { stage, deploys, applied, configuration, deploy, refresh } =
    useStage(organizationId)
  const changes = useMemo(
    () =>
      stage.data
        ? configurationDiff(
            configuration.data ?? emptyConfiguration,
            stage.data.configuration,
          )
        : [],
    [configuration.data, stage.data],
  )
  const loading =
    stage.isLoading || deploys.isLoading || configuration.isLoading
  const error = stage.error ?? deploys.error ?? configuration.error
  const unavailable = !!applied && !applied.has_configuration
  const labels = versionLabels(deploys.data ?? [])
  const deployed =
    deploy.variables === stage.data?.revision ? deploy.data : undefined
  const conflict =
    deploy.error instanceof VoidRequestError && deploy.error.status === 409
  const refreshPage = async () => {
    deploy.reset()
    await refresh()
    if (configuration.isError) await configuration.refetch()
  }

  return (
    <DashboardBody
      title="Stage"
      header={
        <Box columnGap="s">
          <Button
            variant="secondary"
            onClick={refreshPage}
            disabled={deploy.isPending}
            loading={stage.isFetching || deploys.isFetching}
          >
            Refresh
          </Button>
          <Button
            onClick={() => stage.data && deploy.mutate(stage.data.revision)}
            loading={deploy.isPending}
            disabled={
              loading ||
              stage.isFetching ||
              deploys.isFetching ||
              configuration.isFetching ||
              conflict ||
              !!error ||
              unavailable ||
              !stage.data ||
              changes.length === 0 ||
              !!deployed
            }
          >
            {deployed ? 'Deployed' : 'Deploy as draft'}
          </Button>
        </Box>
      }
    >
      <Box flexDirection="column" rowGap="2xl">
        <Text color="muted">
          Review staged changes against the active configuration, then create a
          deployment.
        </Text>
        {loading ? (
          <LoadingBox height={240} borderRadius="m" />
        ) : error ? (
          <Alert
            variant="danger"
            title="Could not load the stage"
            description={error.message}
            actions={[{ text: 'Try again', onClick: refreshPage }]}
          />
        ) : !stage.data ? (
          <EmptyState
            icon={<Layers />}
            title="No staged changes"
            description="Configuration changes saved to the stage will appear here for review and deployment."
          />
        ) : unavailable ? (
          <Alert
            variant="warning"
            title="Applied configuration unavailable"
            description="The active deployment has no stored configuration, so its changes cannot be compared. Deploy a configuration with the CLI before reviewing this stage."
          />
        ) : (
          <>
            <Box
              flexDirection={{ base: 'column', md: 'row' }}
              justifyContent="between"
              gap="m"
              padding="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="m"
            >
              <Box flexDirection="column" rowGap="xs">
                <Text>
                  {applied
                    ? `Applied ${versionLabel(labels, applied.version_id)} → Stage`
                    : 'First deployment'}
                </Text>
                <Text variant="caption" color="muted">
                  {applied
                    ? `${shortVersion(applied.version_id)} · `
                    : 'No active configuration · '}
                  Revision {stage.data.revision}
                </Text>
              </Box>
              <Box gap="s" alignItems="center" flexWrap="wrap">
                <Status
                  status={`${changes.filter((c) => c.action === 'added').length} added`}
                  color="green"
                  size="small"
                />
                <Status
                  status={`${changes.filter((c) => c.action === 'changed').length} changed`}
                  color="blue"
                  size="small"
                />
                <Status
                  status={`${changes.filter((c) => c.action === 'removed').length} removed`}
                  color="red"
                  size="small"
                />
              </Box>
            </Box>
            {deploy.error ? (
              <Alert
                variant="danger"
                title={conflict ? 'Review the stage again' : 'Could not deploy'}
                description={deploy.error.message}
                actions={
                  conflict
                    ? [{ text: 'Refresh stage', onClick: refreshPage }]
                    : undefined
                }
              />
            ) : null}
            {deployed ? (
              <Box role="status">
                <Alert
                  variant="success"
                  title={`Deployment ${versionLabel(labels, deployed.version_id)} ${deployed.status === 'draft' ? 'is ready' : 'already exists'}`}
                  description={`${shortVersion(deployed.version_id)} · ${deployed.status}. The staged configuration remains saved.`}
                />
              </Box>
            ) : null}
            {changes.length === 0 ? (
              <EmptyState
                icon={<Layers />}
                title="No differences"
                description="The staged configuration matches the active configuration."
              />
            ) : (
              <StageChanges changes={changes} />
            )}
            <Text color="muted" variant="caption">
              Deploying creates a draft for separate activation. Removed
              definitions remain available to existing subscriptions.
            </Text>
          </>
        )}
      </Box>
    </DashboardBody>
  )
}
