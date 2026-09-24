'use client'

import { TOOL_SEARCH_NAME } from '@/app/(main)/dashboard/[organization]/(header)/products/new/ai/toolParts'
import { Box } from '@polar-sh/orbit/Box'
import { ToolUIPart } from 'ai'
import { useState } from 'react'
import LogoIcon from '../Brand/logos/LogoIcon'

type ApiToolInput = {
  body?: { name?: string; description?: string }
}

type OperationLabels = {
  input: (body?: ApiToolInput['body']) => string
  output: (body?: ApiToolInput['body']) => string
  error: () => string
}

const namedLabels = (
  field: 'name' | 'description',
  pending: string,
  done: string,
  fallback: { pending: string; done: string },
  error: string,
): OperationLabels => ({
  input: (body) =>
    body?.[field] ? `${pending} "${body[field]}"` : fallback.pending,
  output: (body) =>
    body?.[field] ? `${done} "${body[field]}"` : fallback.done,
  error: () => error,
})

const OPERATION_LABELS: Record<string, OperationLabels> = {
  products_list: {
    input: () => 'Listing products…',
    output: () => 'Products found.',
    error: () => 'Error listing products.',
  },
  products_create: namedLabels(
    'name',
    'Creating product',
    'Created product',
    { pending: 'Creating product…', done: 'Created product.' },
    'Error creating product.',
  ),
  products_update: namedLabels(
    'name',
    'Updating product',
    'Updated product',
    { pending: 'Updating product…', done: 'Product updated.' },
    'Error updating product.',
  ),
  products_update_benefits: {
    input: () => 'Assigning benefits to product…',
    output: () => 'Assigned benefits to product.',
    error: () => 'Error assigning benefits.',
  },
  benefits_list: {
    input: () => 'Listing benefits…',
    output: () => 'Benefits found.',
    error: () => 'Error listing benefits.',
  },
  benefits_create: namedLabels(
    'description',
    'Creating benefit',
    'Created benefit',
    { pending: 'Creating benefit…', done: 'Created benefit.' },
    'Error creating benefit.',
  ),
  benefits_update: namedLabels(
    'description',
    'Updating benefit',
    'Updated benefit',
    { pending: 'Updating benefit…', done: 'Benefit updated.' },
    'Error updating benefit.',
  ),
  meters_list: {
    input: () => 'Listing meters…',
    output: () => 'Meters found.',
    error: () => 'Error listing meters.',
  },
  meters_create: namedLabels(
    'name',
    'Creating meter',
    'Created meter',
    { pending: 'Creating meter…', done: 'Created meter.' },
    'Error creating meter.',
  ),
  meters_update: namedLabels(
    'name',
    'Updating meter',
    'Meter updated',
    { pending: 'Updating meter…', done: 'Meter updated.' },
    'Error updating meter.',
  ),
}

const TOOL_SEARCH_LABELS: OperationLabels = {
  input: () => 'Looking up the API…',
  output: () => 'Looked up the API.',
  error: () => 'Error looking up the API.',
}

const getLabels = (part: ToolUIPart): OperationLabels | undefined => {
  const toolName = part.type.slice('tool-'.length)
  return toolName === TOOL_SEARCH_NAME
    ? TOOL_SEARCH_LABELS
    : OPERATION_LABELS[toolName]
}

const isFailedExecution = (part: ToolUIPart): boolean => {
  if (part.state !== 'output-available') {
    return false
  }
  const output = part.output as { status?: number; error?: unknown }
  return (
    output?.error !== undefined ||
    (output?.status !== undefined && output.status >= 400)
  )
}

const getToolLabel = (part: ToolUIPart): string => {
  const labels = getLabels(part)
  const body = (part.input as ApiToolInput | undefined)?.body

  if (part.state === 'output-error' || isFailedExecution(part)) {
    return labels?.error() ?? 'Something went wrong.'
  }

  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
      return labels?.input(body) ?? 'Working my magic…'
    case 'output-available':
      return labels?.output(body) ?? ''
    default:
      return ''
  }
}

export const ToolCallGroup = ({
  parts,
  messageId,
}: {
  parts: ToolUIPart[]
  messageId: string
}) => {
  const [expanded, setExpanded] = useState(false)

  if (parts.length === 0) return null

  // Single tool - render directly
  if (parts.length === 1) {
    const part = parts[0]
    const label = getToolLabel(part)

    return (
      <p className="dark:text-polar-500 not-prose flex items-center gap-1 text-gray-500">
        <LogoIcon size={24} className="-ml-1.5" />
        {label}
      </p>
    )
  }

  const lastPart = parts[parts.length - 1]
  const isComplete = lastPart.state === 'output-available'

  if (expanded) {
    return (
      <Box flexDirection="column" gap="s">
        <button
          onClick={() => setExpanded(false)}
          className="dark:text-polar-500 flex items-center gap-1 text-left text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
        >
          <LogoIcon size={24} className="-ml-1.5" />
          <Box as="span">
            Took {parts.length} action{parts.length === 1 ? '' : 's'} to
            configure your account
          </Box>
        </button>
        <Box
          marginLeft="xl"
          flexDirection="column"
          gap="xs"
          borderLeftWidth={2}
          borderStyle="solid"
          borderColor="border-primary"
          paddingLeft="l"
        >
          {parts.map((part, index) => {
            const label = getToolLabel(part)
            return (
              <p
                key={`${messageId}-tool-${index}`}
                className="dark:text-polar-500 flex items-center gap-1 text-sm text-gray-500"
              >
                {label}
              </p>
            )
          })}
        </Box>
      </Box>
    )
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="dark:text-polar-500 not-prose flex items-center gap-1 text-left text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
      disabled={!isComplete}
    >
      <LogoIcon size={24} className="-ml-1.5" />
      {isComplete ? (
        <Box as="span">
          Took {parts.length} action{parts.length === 1 ? '' : 's'} to configure
          your account
        </Box>
      ) : (
        <Box as="span">{getToolLabel(lastPart)}</Box>
      )}
    </button>
  )
}
