import {
  useDeleteSlackIntegration,
  useLinkSlackIntegration,
  useSlackIntegration,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { ChannelNamePreview } from './ChannelNamePreview'
import { SlackIntegrationSetupPanel } from './SlackIntegrationSetupPanel'
import { SlackTeamInviteesSelect } from './SlackTeamInviteesSelect'

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
  const { control, watch } =
    useFormContext<schemas['BenefitSlackSharedChannelCreate']>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const description = watch('description')
  const integrationIdFromUrl =
    searchParams?.get('slack_integration_id') ?? undefined

  const { data: integration } = useSlackIntegration({
    integrationId: integrationIdFromUrl,
    benefitId: integrationIdFromUrl ? undefined : benefitId,
  })

  const connected = !!integration?.team_id && !integration.revoked_at
  const integrationId = integration?.id

  // Returning from the OAuth round-trip in update mode yields a freshly
  // installed but still-unlinked integration; link it to the edited benefit.
  const linkIntegration = useLinkSlackIntegration()
  const linkedRef = useRef(false)
  useEffect(() => {
    if (
      update &&
      benefitId &&
      integration &&
      connected &&
      integration.benefit_id !== benefitId &&
      !linkedRef.current
    ) {
      linkedRef.current = true
      linkIntegration.mutate({
        benefit_id: benefitId,
        integration_id: integration.id,
      })
    }
  }, [update, benefitId, integration, connected, linkIntegration])

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
      {connected && integration ? (
        <SlackConnectedBanner integration={integration} />
      ) : (
        <SlackIntegrationSetupPanel
          organizationId={organization.id}
          defaultDisplayName={organization.name}
          integration={integration ?? null}
          returnTo={returnTo}
        />
      )}

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
              <code>{'{metadata.<key>}'}</code> for any value stored in customer
              user metadata. The rendered name is lowercased and
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
                  defaultChecked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Text>Create channel as private</Text>
              </Box>
            </FormControl>
            <FormDescription>
              Recommended. Public channels are visible to anyone in either
              workspace.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {connected && integrationId && (
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
                  defaultChecked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Text>Archive channel on revocation</Text>
              </Box>
            </FormControl>
            <FormDescription>
              When the customer&apos;s benefit is revoked, archive the channel.
              Slack does not allow channel deletion via API.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
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
