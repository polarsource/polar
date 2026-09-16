'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  Button,
  Input,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext, useState } from 'react'
import { shortVersion, useVoidDeploys, VoidDeploy } from '../api'
import { NewScenario } from './store'

const STATUS_COLOR: Record<
  NonNullable<VoidDeploy['status']>,
  'green' | 'blue' | 'gray'
> = { active: 'green', draft: 'blue', archived: 'gray' }

interface ScenarioModalProps {
  isShown: boolean
  hide: () => void
  title: string
  submitLabel: string
  /** Prefills the form; the version is pinned once a scenario exists. */
  initial?: NewScenario
  onSubmit: (input: NewScenario) => void
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <Box as="label" flexDirection="column" rowGap="s" display="flex">
    <Text variant="caption" color="muted">
      {label}
    </Text>
    {children}
  </Box>
)

const Form = ({
  hide,
  initial,
  submitLabel,
  onSubmit,
}: Omit<ScenarioModalProps, 'isShown' | 'title'>) => {
  const { organization } = useContext(OrganizationContext)
  const deploys = useVoidDeploys(organization.id)
  const versions = deploys.data ?? []
  const defaultVersion =
    initial?.basedOn.version ??
    versions.find((d) => d.status === 'active' && d.has_configuration)
      ?.version_id ??
    versions.find((d) => d.has_configuration)?.version_id ??
    ''
  const [versionId, setVersionId] = useState(defaultVersion)
  const [name, setName] = useState(initial?.name ?? '')
  const version = versionId || defaultVersion

  const submit = () => {
    if (!name.trim() || !version) return
    onSubmit({ name: name.trim(), basedOn: { version } })
    hide()
  }

  return (
    <Box
      as="form"
      flexDirection="column"
      rowGap="xl"
      padding="2xl"
      display="flex"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Field label="Version">
        <Select
          value={version}
          onValueChange={setVersionId}
          disabled={initial !== undefined}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((candidate) => (
              <SelectItem
                key={candidate.version_id}
                value={candidate.version_id}
                disabled={!candidate.has_configuration}
              >
                <Box alignItems="center" columnGap="s">
                  <span>{shortVersion(candidate.version_id)}</span>
                  <Status
                    status={candidate.status ?? 'draft'}
                    color={STATUS_COLOR[candidate.status ?? 'draft']}
                    size="small"
                  />
                  {candidate.has_configuration ? null : (
                    <Text variant="caption" color="muted">
                      not branchable
                    </Text>
                  )}
                </Box>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Title">
        <Input
          autoFocus
          placeholder="Usage-first pricing"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Box justifyContent="end" columnGap="s">
        <Button type="button" variant="ghost" onClick={hide}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || !version}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  )
}

export const ScenarioModal = ({
  isShown,
  hide,
  title,
  submitLabel,
  initial,
  onSubmit,
}: ScenarioModalProps) => (
  <Modal
    title={title}
    className="lg:max-w-lg"
    isShown={isShown}
    hide={hide}
    modalContent={
      <Form
        hide={hide}
        initial={initial}
        submitLabel={submitLabel}
        onSubmit={onSubmit}
      />
    }
  />
)
