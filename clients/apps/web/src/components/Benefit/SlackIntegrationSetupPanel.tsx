'use client'

import {
  useGenerateSlackManifest,
  useSaveSlackCredentials,
} from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import useDebounce from '@/utils/useDebounce'
import { schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useCallback, useEffect, useState } from 'react'
import { Well } from '../Shared/Well'
import { SyntaxHighlighterClient } from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { toast } from '../Toast/use-toast'

type Integration = schemas['SlackIntegration']

export const SlackIntegrationSetupPanel = ({
  organizationId,
  defaultDisplayName,
  integration,
  returnTo,
}: {
  organizationId: string
  defaultDisplayName: string
  integration: Integration | null
  returnTo: string
}) => {
  const [displayName, setDisplayName] = useState(
    integration?.display_name ?? defaultDisplayName,
  )
  const [slackAppId, setSlackAppId] = useState(integration?.slack_app_id ?? '')
  const [clientId, setClientId] = useState(integration?.client_id ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const [manifest, setManifest] = useState('')
  const [credentialsError, setCredentialsError] = useState<string | null>(null)

  const { mutate: generateManifest } = useGenerateSlackManifest()
  const saveCredentials = useSaveSlackCredentials()

  const debouncedDisplayName = useDebounce(displayName, 300)
  const displayedManifest = debouncedDisplayName.trim() ? manifest : ''
  useEffect(() => {
    if (!debouncedDisplayName.trim()) {
      return
    }

    generateManifest(
      { display_name: debouncedDisplayName },
      { onSuccess: (r) => r.data && setManifest(r.data.manifest) },
    )
  }, [debouncedDisplayName, generateManifest])

  const saveSlackCredentials = async () => {
    const requiresClientSecret = !integration?.client_secret_last_4
    const requiresSigningSecret = !integration?.signing_secret_last_4
    if (
      !displayName.trim() ||
      !slackAppId.trim() ||
      !clientId.trim() ||
      (requiresClientSecret && !clientSecret.trim()) ||
      (requiresSigningSecret && !signingSecret.trim())
    ) {
      setCredentialsError('Fill in the Slack app credentials before saving.')
      return
    }

    setCredentialsError(null)
    const result = await saveCredentials.mutateAsync({
      organization_id: organizationId,
      display_name: displayName,
      slack_app_id: slackAppId,
      client_id: clientId,
      client_secret: clientSecret || null,
      signing_secret: signingSecret || null,
    })
    if (result.error || !result.data) {
      toast({
        title: 'Could not save credentials',
        description: 'Slack rejected the values. Double-check and try again.',
      })
      return
    }
    // Saving succeeded — send the merchant straight into the OAuth install
    // rather than surfacing a separate authorize step they could miss.
    window.location.href = buildAuthorizeUrl(result.data.id, returnTo)
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      <SetupSection
        title="1. Create your Slack app"
        description="Create a Slack app from this manifest, then paste the credentials below."
      >
        <Box display="flex" flexDirection="column" rowGap="m">
          <Box display="flex" flexDirection="column" rowGap="s">
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
          <ManifestBlock manifest={displayedManifest} />
          <Box display="flex" flexDirection="column" rowGap="s">
            <Button
              asChild
              variant="secondary"
              size="sm"
              wrapperClassNames="self-start"
            >
              <a
                href="https://api.slack.com/apps?new_app=1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create app on api.slack.com
              </a>
            </Button>
            <Text color="muted" variant="caption">
              Choose &ldquo;From an app manifest&rdquo;, pick your workspace,
              and paste the manifest above.
            </Text>
          </Box>
        </Box>
      </SetupSection>

      <SetupSection
        title="2. Paste credentials and connect"
        description="Find these on the Basic Information page of the app you just created. Saving sends you to Slack to authorize the workspace."
      >
        <Box display="flex" flexDirection="column" rowGap="l">
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
                ? `********${integration.client_secret_last_4} (leave blank to keep)`
                : undefined
            }
            value={clientSecret}
            onChange={setClientSecret}
            required={!integration?.client_secret_last_4}
          />
          <LabeledInput
            id="slack-signing-secret"
            label="Signing Secret"
            type="password"
            placeholder={
              integration?.signing_secret_last_4
                ? `********${integration.signing_secret_last_4} (leave blank to keep)`
                : undefined
            }
            value={signingSecret}
            onChange={setSigningSecret}
            required={!integration?.signing_secret_last_4}
          />
          {credentialsError && (
            <Text color="danger" variant="caption">
              {credentialsError}
            </Text>
          )}
          <Button
            type="button"
            loading={saveCredentials.isPending}
            wrapperClassNames="self-start"
            onClick={saveSlackCredentials}
          >
            Save and authorize
          </Button>
        </Box>
      </SetupSection>
    </Box>
  )
}

const SetupSection = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => {
  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      <Box display="flex" flexDirection="column" rowGap="s">
        <h3 className="text-sm leading-none font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </Box>
      {children}
    </Box>
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
      <Well className="overflow-x-auto p-3 text-xs">
        {manifest ? (
          <SyntaxHighlighterClient lang="bash" code={manifest} />
        ) : (
          <Text color="muted" variant="caption">
            Generating...
          </Text>
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

const buildAuthorizeUrl = (integrationId: string, returnTo: string): string => {
  const [path, query = ''] = returnTo.split('?')
  const params = new URLSearchParams(query)
  params.set('slack_integration_id', integrationId)
  const resolvedReturnTo = `${path}?${params.toString()}`
  return `${CONFIG.BASE_URL}/v1/integrations/slack/authorize?integration_id=${integrationId}&return_to=${encodeURIComponent(resolvedReturnTo)}`
}
