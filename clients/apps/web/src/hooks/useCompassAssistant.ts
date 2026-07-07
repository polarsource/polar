'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { useCallback, useRef, useState } from 'react'

export interface MetricChartPoint {
  timestamp: string
  value: number
}

/**
 * The closed set of renderable blocks the assistant can produce. Mirrors the
 * backend `AssistantBlock` union; anything outside it is ignored by the
 * registry rather than rendered.
 */
export interface DataTableColumn {
  key: string
  label: string
  format: 'text' | 'currency' | 'datetime' | 'badge' | 'avatar'
}

export type DataTableRow = Record<string, string | number | null>

export type AssistantBlock =
  | { type: 'text'; text: string }
  | {
      type: 'metric_chart'
      metric: string
      label: string
      unit: string
      points: MetricChartPoint[]
    }
  | { type: 'insight_cards'; insights: schemas['Insight'][] }
  | {
      type: 'entity_list'
      entity: string
      title: string | null
      columns: DataTableColumn[]
      rows: DataTableRow[]
      total_count: number
    }
  | {
      type: 'data_table'
      entity: string
      title: string | null
      columns: DataTableColumn[]
      rows: DataTableRow[]
      total_count: number
    }
  | {
      type: 'customer_card'
      email: string
      name: string | null
      avatar_url: string | null
      created_at: string
    }

export type AssistantPart =
  | { kind: 'text'; text: string }
  | { kind: 'block'; block: AssistantBlock }

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  parts: AssistantPart[]
}

const appendDelta = (parts: AssistantPart[], delta: string): AssistantPart[] => {
  const last = parts[parts.length - 1]
  if (last && last.kind === 'text') {
    return [...parts.slice(0, -1), { kind: 'text', text: last.text + delta }]
  }
  return [...parts, { kind: 'text', text: delta }]
}

/**
 * Client for the Compass assistant SSE endpoint. Streams one turn at a time:
 * `text` deltas and `block` events append to the pending assistant message,
 * `done` carries opaque conversation state we replay on the next turn.
 */
export const useCompassAssistant = (organizationId: string) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const historyRef = useRef<string | null>(null)
  const idRef = useRef(0)

  const appendToAssistant = useCallback(
    (assistantId: string, apply: (parts: AssistantPart[]) => AssistantPart[]) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, parts: apply(message.parts) }
            : message,
        ),
      )
    },
    [],
  )

  const send = useCallback(
    async (prompt: string) => {
      const userId = `m${(idRef.current += 1)}`
      const assistantId = `m${(idRef.current += 1)}`
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', parts: [{ kind: 'text', text: prompt }] },
        { id: assistantId, role: 'assistant', parts: [] },
      ])
      setIsStreaming(true)

      try {
        const response = await fetch(getServerURL('/v1/compass/assistant'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            prompt,
            message_history: historyRef.current,
          }),
        })
        if (!response.ok || !response.body) {
          throw new Error(`assistant request failed (${response.status})`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handle = (rawEvent: string) => {
          let event = 'message'
          let data = ''
          for (const line of rawEvent.split(/\r?\n/)) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) return
          const payload = JSON.parse(data)
          if (event === 'text') {
            appendToAssistant(assistantId, (parts) =>
              appendDelta(parts, payload.delta),
            )
          } else if (event === 'block') {
            appendToAssistant(assistantId, (parts) => [
              ...parts,
              { kind: 'block', block: payload as AssistantBlock },
            ])
          } else if (event === 'done') {
            historyRef.current = payload.message_history
          } else if (event === 'error') {
            appendToAssistant(assistantId, (parts) =>
              appendDelta(parts, payload.message),
            )
          }
        }

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let boundary
          while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
            const rawEvent = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '')
            if (rawEvent.trim() && !rawEvent.startsWith(':')) handle(rawEvent)
          }
        }
      } catch {
        appendToAssistant(assistantId, (parts) =>
          appendDelta(parts, 'Something went wrong. Please try again.'),
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [appendToAssistant, organizationId],
  )

  const reset = useCallback(() => {
    setMessages([])
    historyRef.current = null
  }, [])

  return { messages, send, isStreaming, reset }
}
