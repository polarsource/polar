'use client'

import { fetchCompassThread } from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

export type AssistantPart =
  | schemas['AssistantTextPart']
  | schemas['AssistantBlockPart']
/**
 * The closed set of renderable blocks the assistant can produce. Mirrors the
 * backend `AssistantBlock` union; anything outside it is ignored by the
 * registry rather than rendered.
 */
export type AssistantBlock = schemas['AssistantBlockPart']['block']
export type MetricChartPoint = schemas['MetricChartPoint']
export type DataTableColumn = schemas['DataTableColumn']
export type DataTableRow = schemas['DataTableBlock']['rows'][number]

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  parts: AssistantPart[]
  answeredAt: string
  restored?: boolean
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

interface UseCompassAssistantOptions {
  organizationId: string
  initialThreadId?: string | null
  onThreadChange?: (threadId: string | null) => void
}

/**
 * Client for the Compass assistant SSE endpoint. Streams one turn at a time:
 * `text` deltas and `block` events append to the pending assistant message.
 * Conversation state lives server-side on a thread: `thread` / `done` carry
 * the thread id we send back on the next turn, and `hydrate` replays a
 * stored thread into the message list.
 */
export const useCompassAssistant = ({
  organizationId,
  initialThreadId = null,
  onThreadChange,
}: UseCompassAssistantOptions) => {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  // Ref for send (updated mid-stream), state for consumers. Seeded from
  // initialThreadId so early prompts continue a deep-linked thread.
  const [threadId, setThreadId] = useState<string | null>(initialThreadId)
  const threadIdRef = useRef<string | null>(initialThreadId)
  const idRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const loadRef = useRef(0)
  const onThreadChangeRef = useRef(onThreadChange)
  onThreadChangeRef.current = onThreadChange

  useEffect(() => {
    // Abort the in-flight stream on unmount so the SSE connection closes and
    // no further state updates fire.
    return () => controllerRef.current?.abort()
  }, [])

  const setThread = useCallback((id: string | null) => {
    threadIdRef.current = id
    setThreadId(id)
  }, [])

  // Invalidate in-flight thread loads. Call whenever the on-screen conversation
  // changes so a slow fetch can't resurrect what the user moved on from.
  const claimConversation = useCallback(() => (loadRef.current += 1), [])

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
      // One turn at a time. A send during a live stream used to abort it, and
      // an aborted turn is never recorded server-side: the conversation would
      // silently lose the turn the user just watched.
      if (controllerRef.current) return
      const claim = claimConversation()

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
          // A history selection claims the conversation before its fetch
          // resolves and aborts us.
          if (claim !== loadRef.current) return
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
            // Adopt the new thread so a mid-stream refresh can recover it
            setThread(payload.thread_id)
            onThreadChangeRef.current?.(payload.thread_id)
            void queryClient.invalidateQueries({
              queryKey: ['compass_threads'],
            })
          } else if (event === 'done') {
            setThread(payload.thread_id)
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
        // An aborted stream (unmount, or a thread switch that supersedes it)
        // is not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          appendToAssistant(assistantId, (parts) =>
            appendDelta(parts, 'Something went wrong. Please try again.'),
          )
        }
      } finally {
        // Hydrating another thread already cleared isStreaming and dropped
        // this controller; only the stream still in charge may clear it.
        if (controllerRef.current === controller) {
          setIsStreaming(false)
          controllerRef.current = null
        }
      }
    },
    [
      appendToAssistant,
      claimConversation,
      organizationId,
      queryClient,
      setThread,
    ],
  )

  const hydrate = useCallback(
    (thread: schemas['CompassThreadWithMessages']) => {
      // Replaying a stored thread supersedes whatever was on screen,
      // including a live stream.
      controllerRef.current?.abort()
      controllerRef.current = null
      setIsStreaming(false)
      setThread(thread.id)
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
            parts: message.parts,
            answeredAt: message.created_at,
            restored: true,
            prompt: message.prompt,
          },
        ]),
      )
    },
    [setThread],
  )

  const newChat = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    claimConversation()
    setIsStreaming(false)
    setMessages([])
    setThread(null)
    onThreadChangeRef.current?.(null)
  }, [claimConversation, setThread])

  const loadThread = useCallback(
    async (id: string) => {
      const claim = claimConversation()
      try {
        const detail = await fetchCompassThread(queryClient, id)
        if (claim !== loadRef.current) return
        hydrate(detail)
        onThreadChangeRef.current?.(detail.id)
      } catch {
        // Deleted or inaccessible thread: fall back to a fresh conversation
        // (newChat also drops the seeded thread id, so the next send doesn't
        // post against the dead thread). A superseded load stays quiet: the
        // conversation on screen is no longer the one that failed.
        if (claim !== loadRef.current) return
        newChat()
      }
    },
    [claimConversation, queryClient, hydrate, newChat],
  )

  const selectThread = useCallback(
    (id: string) => {
      if (id === threadIdRef.current) return
      void loadThread(id)
    },
    [loadThread],
  )

  // Hydration is imperative — once on mount for a `?thread=` deep link, and
  // on an explicit history selection. Reactive URL/cache hydration races
  // router.replace and resurrects conversations the user just left.
  const initialLoadedRef = useRef(false)
  useEffect(() => {
    if (!initialThreadId || initialLoadedRef.current) return
    initialLoadedRef.current = true
    void loadThread(initialThreadId)
  }, [initialThreadId, loadThread])

  return { messages, send, isStreaming, threadId, selectThread, newChat }
}
