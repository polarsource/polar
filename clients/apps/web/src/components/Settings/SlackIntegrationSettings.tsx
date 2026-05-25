'use client'

import {
  useDeleteSlackIntegration,
  useGenerateSlackManifest,
  useSaveSlackCredentials,
  useSlackIntegration,
} from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import useDebounce from '@/utils/useDebounce'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { LoadingBox } from '../Shared/LoadingBox'
import { Well } from '../Shared/Well'
import { SyntaxHighlighterClient } from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { toast } from '../Toast/use-toast'
import { Section, SectionDescription } from './Section'

type Integration = schemas['SlackIntegration']

interface Props {
  organization: schemas['Organization']
}

export const SlackIntegrationSettings = ({ organization }: Props) => {
  const { data, isLoading } = useSlackIntegration(organization.id)

  if (isLoading) return <LoadingBox />
  return (
    <CredentialsForm organization={organization} integration={data ?? null} />
  )
}

const CredentialsForm = ({
  organization,
  integration,
}: {
  organization: schemas['Organization']
  integration: Integration | null
}) => {
  const isConnected = !!integration?.team_id && !integration.revoked_at
  const [displayName, setDisplayName] = useState(
    integration?.display_name ?? organization.name,
  )
  const [slackAppId, setSlackAppId] = useState(integration?.slack_app_id ?? '')
  const [clientId, setClientId] = useState(integration?.client_id ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const [manifest, setManifest] = useState('')

  const { mutate: generateManifest } = useGenerateSlackManifest()
  const saveCredentials = useSaveSlackCredentials()

  const debouncedDisplayName = useDebounce(displayName, 300)
  useEffect(() => {
    generateManifest(
      { organization_id: organization.id, display_name: debouncedDisplayName },
      { onSuccess: (r) => r.data && setManifest(r.data.manifest) },
    )
  }, [debouncedDisplayName, organization.id, generateManifest])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await saveCredentials.mutateAsync({
      organization_id: organization.id,
      display_name: displayName,
      slack_app_id: slackAppId,
      client_id: clientId,
      client_secret: clientSecret || null,
      signing_secret: signingSecret || null,
    })
    if (result.error) {
      toast({
        title: 'Could not save credentials',
        description: 'Slack rejected the values. Double-check and try again.',
      })
      return
    }
    toast({
      title: isConnected
        ? 'Credentials updated.'
        : 'Credentials saved. Now authorize Slack below.',
    })
    setClientSecret('')
    setSigningSecret('')
  }

  const hasCredentials = !!integration?.slack_app_id
  const showAuthorize = hasCredentials && !isConnected

  return (
    <Box display="flex" flexDirection="column" rowGap="3xl">
      {isConnected && <ConnectedBanner integration={integration} />}

      <Section>
        <SectionDescription
          title={isConnected ? 'App manifest' : '1. Create your Slack app'}
          description={
            isConnected
              ? 'Re-paste this manifest in your Slack app if you need to update scopes or events.'
              : 'Open api.slack.com/apps → Create New App → From an app manifest → pick your workspace → paste the manifest below.'
          }
        />
        <Box display="flex" flexDirection="column" rowGap="m">
          <Label htmlFor="slack-display-name">Display name</Label>
          <Input
            id="slack-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={35}
          />
          <Text color="muted" variant="caption">
            Shown on the bot user inside your Slack workspace.
          </Text>
        </Box>
        <ManifestBlock manifest={manifest} />
      </Section>

      <Section>
        <SectionDescription
          title={
            isConnected
              ? 'Credentials'
              : '2. Paste credentials from your Slack app'
          }
          description={
            isConnected
              ? 'Update individual fields to rotate them. Leave a secret empty to keep the current value. Changing App ID or Client ID requires re-authorizing.'
              : 'Find these on the Basic Information page of the app you just created.'
          }
        />
        <Box
          as="form"
          display="flex"
          flexDirection="column"
          rowGap="l"
          onSubmit={onSubmit}
        >
          <LabeledInput
            id="slack-app-id"
            label="App ID"
            placeholder="A0..."
            value={slackAppId}
            onChange={setSlackAppId}
            required
          />
          <LabeledInput
            id="slack-client-id"
            label="Client ID"
            value={clientId}
            onChange={setClientId}
            required
          />
          <LabeledInput
            id="slack-client-secret"
            label="Client Secret"
            type="password"
            placeholder={
              integration?.client_secret_last_4
                ? `••••••••${integration.client_secret_last_4} (leave blank to keep)`
                : undefined
            }
            value={clientSecret}
            onChange={setClientSecret}
            required={!integration}
          />
          <LabeledInput
            id="slack-signing-secret"
            label="Signing Secret"
            type="password"
            placeholder={
              integration?.signing_secret_last_4
                ? `••••••••${integration.signing_secret_last_4} (leave blank to keep)`
                : undefined
            }
            value={signingSecret}
            onChange={setSigningSecret}
            required={!integration}
          />
          <Button
            type="submit"
            loading={saveCredentials.isPending}
            wrapperClassNames="self-start"
          >
            {isConnected ? 'Save changes' : 'Save credentials'}
          </Button>
        </Box>
      </Section>

      {showAuthorize && <AuthorizeSection organization={organization} />}
    </Box>
  )
}

const ConnectedBanner = ({ integration }: { integration: Integration }) => {
  const disconnect = useDeleteSlackIntegration()
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  const onDisconnect = async () => {
    const result = await disconnect.mutateAsync({
      organizationId: integration.organization_id,
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
        padding="l"
        borderRadius="m"
        backgroundColor="background-success"
        columnGap="m"
      >
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Text variant="heading-xxs" as="h3">
            Connected as {integration.team_name ?? integration.team_id}
          </Text>
          <Text color="muted">
            Your Slack app is installed and ready to provision channels.
          </Text>
        </Box>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDisconnectModal(true)}
        >
          Disconnect
        </Button>
      </Box>

      <ConfirmModal
        isShown={showDisconnectModal}
        hide={() => setShowDisconnectModal(false)}
        title="Disconnect Slack workspace"
        description="This removes the Slack integration from Polar, including the credentials you pasted. Existing channels stay in Slack but Polar can no longer manage them. You'll need to paste the manifest and credentials again to reconnect."
        onConfirm={onDisconnect}
        destructive
        destructiveText="Disconnect"
      />
    </>
  )
}

const ManifestBlock = ({ manifest }: { manifest: string }) => {
  const copy = useCallback(() => {
    if (!manifest) return
    navigator.clipboard.writeText(manifest)
    toast({ title: 'Manifest copied to clipboard' })
  }, [manifest])

  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      <Box display="flex" alignItems="center" justifyContent="between">
        <Label>App manifest</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copy}
          disabled={!manifest}
        >
          Copy manifest
        </Button>
      </Box>
      <Well className="overflow-x-auto p-4 text-sm">
        {manifest ? (
          <SyntaxHighlighterClient lang="json" code={manifest} />
        ) : (
          <Text color="muted">Generating...</Text>
        )}
      </Well>
    </Box>
  )
}

const LabeledInput = ({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  required = true,
}: {
  id: string
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    />
  </Box>
)

const AuthorizeSection = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const searchParams = useSearchParams()
  const returnTo =
    searchParams?.get('return_to') ??
    (typeof window !== 'undefined' ? window.location.pathname : '/')
  const href = `${CONFIG.BASE_URL}/v1/integrations/slack/authorize?organization_id=${organization.id}&return_to=${encodeURIComponent(returnTo)}`

  return (
    <Section>
      <SectionDescription
        title="3. Authorize Slack workspace"
        description="Open Slack's authorization page and approve installation into your workspace."
      />
      <Button asChild wrapperClassNames="self-start">
        <a href={href}>Authorize Slack workspace</a>
      </Button>
    </Section>
  )
}
