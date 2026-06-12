import {
  useDeleteSlackIntegration,
  useSlackIntegration,
  useSlackIntegrations,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  TextArea,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { ChannelNamePreview } from './ChannelNamePreview'
import { SlackIntegrationSetupPanel } from './SlackIntegrationSetupPanel'
import { SlackTeamInviteesSelect } from './SlackTeamInviteesSelect'

const CREATE_NEW_SLACK_APP = 'new'

interface Props {
  organization: schemas['Organization']
  update?: boolean
  benefitId?: string
}

export const SlackSharedChannelBenefitForm = ({
  organization,
  update = false,
  benefitId,
}: Props) => {
  const { control, setValue, watch } =
    useFormContext<schemas['BenefitSlackSharedChannelCreate']>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const description = watch('description')
  const linkedIntegrationId = watch('properties.slack_integration_id')
  const integrationIdFromUrl =
    searchParams?.get('slack_integration_id') ?? undefined
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | undefined
  >(integrationIdFromUrl ?? linkedIntegrationId ?? undefined)

  const { data: integrations } = useSlackIntegrations(organization.id, {
    enabled: !update,
  })
  const resolvedIntegrationId =
    selectedIntegrationId && selectedIntegrationId !== CREATE_NEW_SLACK_APP
      ? selectedIntegrationId
      : undefined
  const { data: resolvedIntegration } = useSlackIntegration(
    resolvedIntegrationId,
  )
  const selectedIntegrationFromList = integrations?.find(
    (integration) => integration.id === selectedIntegrationId,
  )
  const integrationResolutionPending =
    !!resolvedIntegrationId &&
    resolvedIntegration === undefined &&
    selectedIntegrationFromList === undefined
  const selectedIntegration = useMemo(() => {
    if (selectedIntegrationId === CREATE_NEW_SLACK_APP) {
      return null
    }
    return resolvedIntegration ?? selectedIntegrationFromList ?? null
  }, [resolvedIntegration, selectedIntegrationFromList, selectedIntegrationId])

  const showIntegrationSelect = !update && (integrations?.length ?? 0) > 0
  const setupNewIntegration =
    selectedIntegrationId === CREATE_NEW_SLACK_APP ||
    (!showIntegrationSelect && !selectedIntegration)
  const integration = selectedIntegration ?? null

  const connected = !!integration?.team_id && !integration.revoked_at
  const integrationId = integration?.id

  useEffect(() => {
    if (!connected || !integrationId || linkedIntegrationId === integrationId) {
      return
    }

    setValue('properties.slack_integration_id', integrationId, {
      shouldDirty: update,
      shouldValidate: true,
    })
  }, [connected, integrationId, linkedIntegrationId, setValue, update])

  useEffect(() => {
    if (
      connected ||
      integrationResolutionPending ||
      linkedIntegrationId === ''
    ) {
      return
    }
    if (update && resolvedIntegration === undefined) {
      return
    }

    setValue('properties.slack_integration_id', '', {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [
    connected,
    integrationResolutionPending,
    linkedIntegrationId,
    resolvedIntegration,
    setValue,
    update,
  ])

  const returnTo = (() => {
    const params = new URLSearchParams()
    if (update && benefitId) {
      params.set('edit_benefit', benefitId)
    } else {
      params.set('create_benefit', 'true')
      params.set('type', 'slack_shared_channel')
      params.set('description', description ?? '')
    }
    return `${pathname}?${params.toString()}`
  })()

  return (
    <>
      <FormField
        control={control}
        name="properties.slack_integration_id"
        rules={{ required: 'Connect Slack before creating this benefit.' }}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <input type="hidden" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {showIntegrationSelect && (
        <SlackIntegrationSelect
          integrations={integrations ?? []}
          value={selectedIntegrationId}
          onChange={setSelectedIntegrationId}
        />
      )}

      {connected && integration ? (
        <SlackConnectedBanner integration={integration} />
      ) : !selectedIntegrationId && !setupNewIntegration ? (
        <FormDescription>
          Select an existing Slack app or create a new one.
        </FormDescription>
      ) : (
        <>
          <SlackIntegrationSetupPanel
            key={setupNewIntegration ? 'new' : (integration?.id ?? 'new')}
            organizationId={organization.id}
            defaultDisplayName={organization.name}
            integration={setupNewIntegration ? null : integration}
            returnTo={returnTo}
          />
          <FormDescription>
            Finish the Slack connection first. Channel settings will appear
            after authorization.
          </FormDescription>
        </>
      )}

      {!connected || !integration ? null : (
        <>
          <FormField
            control={control}
            name="properties.channel_name_template"
            rules={{ required: 'This field is required' }}
            defaultValue=""
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel name template</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="support-{customer_name}"
                    maxLength={80}
                  />
                </FormControl>
                <FormDescription>
                  Supports <code>{'{customer_name}'}</code>,{' '}
                  <code>{'{customer_email_local}'}</code>, and{' '}
                  <code>{'{metadata.<key>}'}</code> for any value stored in
                  customer user metadata. The rendered name is lowercased and
                  non-alphanumerics become dashes.
                </FormDescription>
                <ChannelNamePreview
                  template={field.value ?? ''}
                  organizationId={organization.id}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="properties.private"
            defaultValue={true}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Box display="flex" alignItems="center" columnGap="s">
                    <Checkbox
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                    <Text>Create channel as private</Text>
                  </Box>
                </FormControl>
                <FormDescription>
                  Public channels are visible to anyone in either workspace.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {integrationId && (
            <FormField
              control={control}
              name="properties.team_invitees"
              defaultValue={[]}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team members to invite</FormLabel>
                  <FormControl>
                    <SlackTeamInviteesSelect
                      integrationId={integrationId}
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    These users from your Slack workspace will be added to every
                    channel created for this benefit.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name="properties.welcome_message"
            defaultValue=""
            render={({ field }) => (
              <FormItem>
                <FormLabel>Welcome message (optional)</FormLabel>
                <FormControl>
                  <TextArea
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Welcome! This is your private channel with our team."
                    maxLength={4000}
                  />
                </FormControl>
                <FormDescription>
                  Posted by the Slack bot to the channel right after it&apos;s
                  created.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="properties.archive_on_revoke"
            defaultValue={true}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Box display="flex" alignItems="center" columnGap="s">
                    <Checkbox
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                    <Text>Archive channel on revocation</Text>
                  </Box>
                </FormControl>
                <FormDescription>
                  When the customer&apos;s benefit is revoked, archive the
                  channel. Slack does not allow channel deletion via API.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  )
}

const SlackIntegrationSelect = ({
  integrations,
  value,
  onChange,
}: {
  integrations: schemas['SlackIntegration'][]
  value?: string
  onChange: (value: string) => void
}) => {
  return (
    <FormItem>
      <FormLabel>Slack app</FormLabel>
      <FormControl>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a Slack app" />
          </SelectTrigger>
          <SelectContent>
            {integrations.map((integration) => {
              const installed = !!integration.team_id && !integration.revoked_at
              return (
                <SelectItem key={integration.id} value={integration.id}>
                  {integration.display_name}
                  {integration.team_name ? ` · ${integration.team_name}` : ''}
                  {installed ? '' : ' · Reconnect required'}
                </SelectItem>
              )
            })}
            <SelectItem value={CREATE_NEW_SLACK_APP}>
              Create new Slack app
            </SelectItem>
          </SelectContent>
        </Select>
      </FormControl>
      <FormDescription>
        Choose an existing Slack app for this benefit, or create a new app.
      </FormDescription>
    </FormItem>
  )
}

const SlackConnectedBanner = ({
  integration,
}: {
  integration: schemas['SlackIntegration']
}) => {
  const disconnect = useDeleteSlackIntegration()
  const [showConfirm, setShowConfirm] = useState(false)

  const onDisconnect = async () => {
    const result = await disconnect.mutateAsync({
      integrationId: integration.id,
    })
    if (result.error) {
      toast({ title: 'Could not disconnect Slack workspace.' })
      return
    }
    toast({ title: 'Slack workspace disconnected.' })
  }

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        padding="m"
        borderRadius="m"
        backgroundColor="background-success"
        columnGap="m"
      >
        <Text variant="caption">
          Connected to {integration.team_name ?? integration.team_id}
        </Text>
        <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
          Disconnect
        </Button>
      </Box>
      <ConfirmModal
        isShown={showConfirm}
        hide={() => setShowConfirm(false)}
        title="Disconnect Slack workspace"
        description="This removes the Slack integration from Polar. Existing channels stay in Slack but Polar can no longer manage them."
        onConfirm={onDisconnect}
        destructive
        destructiveText="Disconnect"
      />
    </>
  )
}
