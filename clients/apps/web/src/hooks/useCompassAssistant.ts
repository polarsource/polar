'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  answeredAt: string
  /** True when rehydrated from a stored thread — its data blocks are
   * snapshots from `answeredAt`, not live queries. */
  restored?: boolean
  /** The user prompt that produced this assistant turn, for re-asking it
   * against current data. */
  prompt?: string
}

const appendDelta = (
  parts: AssistantPart[],
  delta: string,
): AssistantPart[] => {
  const last = parts[parts.length - 1]
  if (last && last.kind === 'text') {
    return [...parts.slice(0, -1), { kind: 'text', text: last.text + delta }]
  }
  return [...parts, { kind: 'text', text: delta }]
}

/**
 * Client for the Compass assistant SSE endpoint. Streams one turn at a time:
 * `text` deltas and `block` events append to the pending assistant message.
 * Conversation state lives server-side on a thread: `thread` / `done` carry
 * the thread id we send back on the next turn, and `hydrate` replays a
 * stored thread into the message list.
 */
export const useCompassAssistant = (
  organizationId: string,
  onThreadCreated?: (threadId: string) => void,
  initialThreadId: string | null = null,
) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  // Ref is what `send` posts (updated mid-stream). State mirrors for render.
  // Seeded from the deep link so a prompt before rehydration continues that thread.
  const [threadId, setThreadId] = useState<string | null>(initialThreadId)
  const threadIdRef = useRef<string | null>(initialThreadId)
  const idRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const onThreadCreatedRef = useRef(onThreadCreated)
  onThreadCreatedRef.current = onThreadCreated

  useEffect(() => {
    // Abort the in-flight stream on unmount so the SSE connection closes and
    // no further state updates fire.
    return () => controllerRef.current?.abort()
  }, [])

  const appendToAssistant = useCallback(
    (
      assistantId: string,
      apply: (parts: AssistantPart[]) => AssistantPart[],
    ) => {
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
      const answeredAt = new Date().toISOString()
      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: 'user',
          parts: [{ kind: 'text', text: prompt }],
          answeredAt,
        },
        { id: assistantId, role: 'assistant', parts: [], answeredAt, prompt },
      ])
      setIsStreaming(true)

      // One live stream at a time: a new send supersedes the previous one,
      // which would otherwise race it for the thread and isStreaming.
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const response = await fetch(getServerURL('/v1/compass/assistant'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            organization_id: organizationId,
            prompt,
            thread_id: threadIdRef.current,
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
          } else if (event === 'thread') {
            threadIdRef.current = payload.thread_id
            setThreadId(payload.thread_id)
            onThreadCreatedRef.current?.(payload.thread_id)
          } else if (event === 'done') {
            threadIdRef.current = payload.thread_id
            setThreadId(payload.thread_id)
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
      } catch (error) {
        // An aborted stream (unmount or superseding send) is not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          appendToAssistant(assistantId, (parts) =>
            appendDelta(parts, 'Something went wrong. Please try again.'),
          )
        }
      } finally {
        // A superseding send owns isStreaming now; only the current stream
        // may clear it.
        if (controllerRef.current === controller) {
          setIsStreaming(false)
          controllerRef.current = null
        }
      }
    },
    [appendToAssistant, organizationId],
  )

  const hydrate = useCallback(
    (thread: schemas['CompassThreadWithMessages']) => {
      controllerRef.current?.abort()
      controllerRef.current = null
      setIsStreaming(false)
      threadIdRef.current = thread.id
      setThreadId(thread.id)
      setMessages(
        thread.messages.flatMap((message) => [
          {
            id: `${message.id}-prompt`,
            role: 'user' as const,
            parts: [{ kind: 'text' as const, text: message.prompt }],
            answeredAt: message.created_at,
            restored: true,
          },
          {
            id: message.id,
            role: 'assistant' as const,
            parts: message.parts as AssistantPart[],
            answeredAt: message.created_at,
            restored: true,
            prompt: message.prompt,
          },
        ]),
      )
    },
    [],
  )

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setIsStreaming(false)
    setMessages([])
    threadIdRef.current = null
    setThreadId(null)
  }, [])

  return { messages, send, isStreaming, reset, hydrate, threadId }
}
