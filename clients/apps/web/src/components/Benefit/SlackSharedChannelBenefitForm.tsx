import {
  usePreviewSlackChannelName,
  useSlackIntegration,
} from '@/hooks/queries'
import { useDebouncedCallback } from '@/hooks/utils'
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
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { SlackTeamInviteesSelect } from './SlackTeamInviteesSelect'

interface Props {
  organization: schemas['Organization']
}

export const SlackSharedChannelBenefitForm = ({ organization }: Props) => {
  const { data: integration, isLoading } = useSlackIntegration(organization.id)
  const { control, watch } =
    useFormContext<schemas['BenefitSlackSharedChannelCreate']>()
  const pathname = usePathname()
  const description = watch('description')

  const connectHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set('create_benefit', 'true')
    params.set('type', 'slack_shared_channel')
    if (description) {
      params.set('description', description)
    }
    const returnTo = `${pathname}?${params.toString()}`
    return `/dashboard/${organization.slug}/settings/integrations/slack?return_to=${encodeURIComponent(returnTo)}`
  }, [pathname, description, organization.slug])

  if (isLoading) return null

  if (!integration?.team_id || integration.revoked_at) {
    return (
      <Box
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        padding="l"
        display="flex"
        flexDirection="column"
        rowGap="m"
      >
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h4">
            Connect your Slack workspace
          </Text>
          <Text color="muted">
            Set up the Slack integration first. We&apos;ll bring you back here
            when it&apos;s done.
          </Text>
        </Box>
        <Button asChild wrapperClassNames="self-start">
          <a href={connectHref}>Connect Slack</a>
        </Button>
      </Box>
    )
  }

  return (
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

const ChannelNamePreview = ({
  template,
  organizationId,
}: {
  template: string
  organizationId: string
}) => {
  const preview = usePreviewSlackChannelName()
  const [rendered, setRendered] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = useDebouncedCallback(
    async (t: string) => {
      if (!t) {
        setRendered(null)
        setError(null)
        return
      }
      const result = await preview.mutateAsync({
        organization_id: organizationId,
        template: t,
        customer_name: 'Sample Customer',
        customer_email: 'customer@example.com',
      })
      if (result.error) {
        const detail = result.error.detail?.[0]?.msg ?? 'Invalid template'
        setError(detail)
        setRendered(null)
        return
      }
      setError(null)
      setRendered(result.data?.channel_name ?? null)
    },
    250,
    [organizationId],
  )

  useEffect(() => {
    fetchPreview(template)
  }, [template, fetchPreview])

  if (!template) return null

  return (
    <Box marginTop="xs">
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : rendered ? (
        <Text variant="caption" color="muted">
          Preview: <code>#{rendered}</code> (metadata placeholders shown as
          their key name; real customers will use their actual values)
        </Text>
      ) : null}
    </Box>
  )
}
