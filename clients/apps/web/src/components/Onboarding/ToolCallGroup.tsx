/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { DynamicToolUIPart } from 'ai'
import { useState } from 'react'
import LogoIcon from '../Brand/LogoIcon'

function ensureJSONArgument<T>(callback: (a: T | undefined) => string) {
  return (arg: T | string) => {
    if (!arg) {
      return callback(undefined)
    }

    if (typeof arg === 'string') {
      try {
        return callback(JSON.parse(arg))
      } catch {
        return callback(undefined)
      }
    }

    if (
      typeof arg === 'object' &&
      'body' in arg &&
      typeof arg.body === 'string'
    ) {
      try {
        return callback({ ...arg, body: JSON.parse(arg.body) } as T)
      } catch {
        return callback(arg)
      }
    }

    return callback(arg)
  }
}

const TOOL_LABELS = {
  polar_products_list: {
    input: () => 'Listing products…',
    output: () => 'Products found.',
    error: () => 'Error listing products.',
  },
  polar_products_create: {
    input: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Creating product "${input.body.name}"`
        : 'Creating product…',
    ),
    output: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Created product "${input.body.name}"`
        : 'Created product.',
    ),
    error: () => 'Error creating product.',
  },
  polar_products_update_benefits: {
    input: () => 'Assigning benefits to product…',
    output: () => 'Assigned benefits to product.',
    error: () => 'Error assigning benefits.',
  },
  polar_benefits_list: {
    input: () => 'Listing benefits…',
    output: () => 'Benefits found.',
    error: () => 'Error listing benefits.',
  },
  polar_benefits_create: {
    input: ensureJSONArgument((input?: { body: { description?: string } }) =>
      input?.body?.description
        ? `Creating benefit "${input.body.description}"`
        : 'Creating benefit…',
    ),
    output: ensureJSONArgument((input?: { body: { description?: string } }) =>
      input?.body?.description
        ? `Created benefit "${input.body.description}"`
        : 'Created benefit.',
    ),
    error: () => 'Error creating benefit.',
  },
  polar_benefits_update: {
    input: ensureJSONArgument((input?: { body: { description?: string } }) =>
      input?.body?.description
        ? `Updating benefit "${input.body.description}"`
        : 'Updating benefit…',
    ),
    output: ensureJSONArgument((input?: { body: { description?: string } }) =>
      input?.body?.description
        ? `Updated benefit "${input.body.description}"`
        : 'Benefit updated.',
    ),
    error: () => 'Error updating benefit.',
  },
  polar_meters_list: {
    input: () => 'Listing meters…',
    output: () => 'Meters found.',
    error: () => 'Error listing meters.',
  },
  polar_meters_create: {
    input: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Creating meter "${input.body.name}"`
        : 'Creating meter…',
    ),
    output: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Created meter "${input.body.name}"`
        : 'Created meter.',
    ),
    error: () => 'Error creating meter.',
  },
  polar_meters_update: {
    input: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Updating meter "${input.body.name}"`
        : 'Updating meter…',
    ),
    output: ensureJSONArgument((input?: { body: { name?: string } }) =>
      input?.body?.name
        ? `Meter updated "${input.body.name}"`
        : 'Meter updated.',
    ),
    error: () => 'Error updating meter.',
  },
}

const getToolLabel = (part: DynamicToolUIPart): string => {
  switch (part.state) {
    case 'input-streaming':
      return (
        TOOL_LABELS[part.toolName as keyof typeof TOOL_LABELS]?.input?.(
          part.input as any,
        ) ?? 'Working my magic…'
      )

    case 'input-available':
      return (
        TOOL_LABELS[part.toolName as keyof typeof TOOL_LABELS]?.input?.(
          part.input as any,
        ) ?? 'Working my magic…'
      )
    case 'output-available':
      return (
        TOOL_LABELS[part.toolName as keyof typeof TOOL_LABELS]?.output?.(
          part.input as any,
        ) ?? ''
      )
    case 'output-error':
      return (
        TOOL_LABELS[part.toolName as keyof typeof TOOL_LABELS]?.error?.() ??
        'Something went wrong.'
      )
  }
}

export const ToolCallGroup = ({
  parts,
  messageId,
}: {
  parts: DynamicToolUIPart[]
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
      <div className="not-prose flex flex-col gap-2">
        <button
          onClick={() => setExpanded(false)}
          className="dark:text-polar-500 flex items-center gap-1 text-left text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
        >
          <LogoIcon size={24} className="-ml-1.5" />
          <span>
            Took {parts.length} action{parts.length === 1 ? '' : 's'} to
            configure your account
          </span>
        </button>
        <div className="dark:border-polar-700 ml-6 flex flex-col gap-1.5 border-l-2 border-gray-200 pl-4">
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
        </div>
      </div>
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
        <>
          <span>
            Took {parts.length} action{parts.length === 1 ? '' : 's'} to
            configure your account
          </span>
        </>
      ) : (
        <span>{getToolLabel(lastPart)}</span>
      )}
    </button>
  )
}
