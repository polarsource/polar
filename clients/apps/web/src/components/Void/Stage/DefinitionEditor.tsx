'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { VoidRequestError } from '../api'
import { useVoidDataSource } from '../dataSource'
import { DefinitionFields, type EditableKind } from './DefinitionFields'
import type { Configuration, Definition } from './diff'
import { useSaveStage, useStage } from './queries'

export const DefinitionEditor = ({
  kind,
  slug,
}: {
  kind: EditableKind
  slug: string
}) => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  return live ? (
    <Editor
      key={`${organization.id}-${kind}-${slug}`}
      organizationId={organization.id}
      stageHref={`/void/dashboard/${organization.slug}/definition/stage`}
      kind={kind}
      slug={slug}
    />
  ) : null
}

const Editor = ({
  organizationId,
  stageHref,
  kind,
  slug,
}: {
  organizationId: string
  stageHref: string
  kind: EditableKind
  slug: string
}) => {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <Box flexDirection="column" rowGap="m" alignItems="start">
      {saved ? (
        <Text color="muted" role="status">
          Saved to stage — not active yet.{' '}
          <Link href={stageHref}>Review staged changes →</Link>
        </Text>
      ) : null}
      {editing ? (
        <EditorLoader
          organizationId={organizationId}
          kind={kind}
          slug={slug}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setSaved(true)
          }}
        />
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setSaved(false)
            setEditing(true)
          }}
        >
          Edit {kind === 'products' ? 'product' : 'meter'}
        </Button>
      )}
    </Box>
  )
}

const EditorLoader = ({
  organizationId,
  kind,
  slug,
  onCancel,
  onSaved,
}: {
  organizationId: string
  kind: EditableKind
  slug: string
  onCancel: () => void
  onSaved: () => void
}) => {
  const { stage, deploys, configuration } = useStage(organizationId)
  const source = stage.data?.configuration ?? configuration.data
  const error =
    stage.error ?? (!stage.data ? (deploys.error ?? configuration.error) : null)
  const loading =
    stage.isLoading ||
    (!stage.data && (deploys.isLoading || configuration.isLoading))
  const definition = source?.[kind].find((item) => item.slug === slug)
  if (loading) return <LoadingBox height={128} borderRadius="m" />
  if (error || !source || !definition)
    return (
      <Alert
        variant="warning"
        title="Cannot edit this definition"
        description={
          error?.message ??
          (source
            ? 'This definition is not in the staged configuration.'
            : 'No active configuration is available to start a stage.')
        }
        actions={[{ text: 'Close', onClick: onCancel }]}
      />
    )
  return (
    <DefinitionForm
      organizationId={organizationId}
      kind={kind}
      configuration={source}
      definition={definition}
      revision={stage.data?.revision ?? null}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  )
}

const DefinitionForm = ({
  organizationId,
  kind,
  configuration,
  definition,
  revision,
  onCancel,
  onSaved,
}: {
  organizationId: string
  kind: EditableKind
  configuration: Configuration
  definition: Definition
  revision: number | null
  onCancel: () => void
  onSaved: () => void
}) => {
  const [source] = useState({ configuration, revision })
  const [value, setValue] = useState(definition)
  const save = useSaveStage(organizationId)
  const conflict =
    save.error instanceof VoidRequestError && save.error.status === 409
  return (
    <Box
      as="form"
      width="100%"
      maxWidth={560}
      flexDirection="column"
      rowGap="l"
      padding="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="m"
      onSubmit={(event) => {
        event.preventDefault()
        if (save.isPending || conflict) return
        save.mutate(
          {
            expected_revision: source.revision,
            configuration: {
              ...source.configuration,
              [kind]: source.configuration[kind].map((item) =>
                item.slug === value.slug ? value : item,
              ),
            },
          },
          { onSuccess: onSaved },
        )
      }}
    >
      <Text as="h2" variant="heading-xs">
        Edit {value.slug}
      </Text>
      <Alert
        variant={source.revision === null ? 'info' : 'warning'}
        title={
          source.revision === null
            ? 'Editing active configuration'
            : `Editing staged configuration · Revision ${source.revision}`
        }
        description={
          source.revision === null
            ? 'Saving creates a stage for review. The active configuration will not change until you deploy and activate it.'
            : 'These are staged values, not the active configuration. The details below still show the deployed version.'
        }
      />
      <Box
        as="fieldset"
        disabled={save.isPending}
        flexDirection="column"
        rowGap="l"
      >
        <DefinitionFields kind={kind} value={value} onChange={setValue} />
      </Box>
      {save.error ? (
        <Alert
          variant="danger"
          title={conflict ? 'The stage has changed' : 'Could not save changes'}
          description={
            conflict
              ? 'Close and reopen the editor to load the latest stage before editing again.'
              : save.error.message
          }
        />
      ) : null}
      <Box gap="s">
        <Button
          type="submit"
          loading={save.isPending}
          disabled={save.isPending || conflict}
        >
          Save to stage
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  )
}
