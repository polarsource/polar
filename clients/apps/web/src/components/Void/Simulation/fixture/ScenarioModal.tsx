'use client'

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
import { useState } from 'react'
import { DEFINITIONS, VoidDefinition } from '../../fixtures'
import { NewScenario } from './store'

const STATUS_COLOR: Record<
  VoidDefinition['status'],
  'green' | 'blue' | 'gray'
> = { Active: 'green', Draft: 'blue', Archived: 'gray' }

interface ScenarioModalProps {
  isShown: boolean
  hide: () => void
  title: string
  submitLabel: string
  /** Prefills the form; omit to start from the active definition. */
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

const definitionIdFor = (initial?: NewScenario) =>
  DEFINITIONS.find(
    (candidate) =>
      candidate.name === initial?.basedOn.definition &&
      candidate.version === initial?.basedOn.version,
  )?.id ?? DEFINITIONS[0].id

const Form = ({
  hide,
  initial,
  submitLabel,
  onSubmit,
}: Omit<ScenarioModalProps, 'isShown' | 'title'>) => {
  const [definitionId, setDefinitionId] = useState(definitionIdFor(initial))
  const [name, setName] = useState(initial?.name ?? '')
  const definition =
    DEFINITIONS.find((candidate) => candidate.id === definitionId) ??
    DEFINITIONS[0]

  const submit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      basedOn: { definition: definition.name, version: definition.version },
    })
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
      <Field label="Definition">
        <Select value={definitionId} onValueChange={setDefinitionId}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a definition" />
          </SelectTrigger>
          <SelectContent>
            {DEFINITIONS.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                <Box alignItems="center" columnGap="s">
                  <span>
                    {candidate.name} · {candidate.version}
                  </span>
                  <Status
                    status={candidate.status}
                    color={STATUS_COLOR[candidate.status]}
                    size="small"
                  />
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
        <Button type="submit" disabled={!name.trim()}>
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
