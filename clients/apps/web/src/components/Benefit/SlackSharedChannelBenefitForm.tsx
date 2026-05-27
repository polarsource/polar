import { useDeleteSlackIntegration, useSlackIntegration } from '@/hooks/queries'
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
import { useMemo, useState } from 'react'
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
  const { data: integration, isLoading } = useSlackIntegration(organization.id)
  const { control, watch } =
    useFormContext<schemas['BenefitSlackSharedChannelCreate']>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentQueryString = searchParams.toString()
  const description = watch('description')

  const returnTo = useMemo(() => {
    if (update) {
      const params = new URLSearchParams(currentQueryString)
      if (benefitId) {
        params.set('edit_benefit', benefitId)
      }
      const queryString = params.toString()
      return `${pathname}${queryString ? `?${queryString}` : ''}`
    }

    const params = new URLSearchParams()
    params.set('create_benefit', 'true')
    params.set('type', 'slack_shared_channel')
    if (description) {
      params.set('description', description)
    }
    return `${pathname}?${params.toString()}`
  }, [pathname, currentQueryString, benefitId, description, update])

  if (isLoading) return null

  if (!integration?.team_id || integration.revoked_at) {
    return (
      <SlackIntegrationSetupPanel
        organization={organization}
        integration={integration ?? null}
        returnTo={returnTo}
      />
    )
  }

  return (
    <>
      <SlackConnectedBanner
        integration={integration}
        organizationId={organization.id}
      />
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

      <FormField
        control={control}
        name="properties.team_invitees"
        defaultValue={[]}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Team members to invite</FormLabel>
            <FormControl>
              <SlackTeamInviteesSelect
                organizationId={organization.id}
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
  organizationId,
}: {
  integration: schemas['SlackIntegration']
  organizationId: string
}) => {
  const disconnect = useDeleteSlackIntegration()
  const [showConfirm, setShowConfirm] = useState(false)

  const onDisconnect = async () => {
    const result = await disconnect.mutateAsync({ organizationId })
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
