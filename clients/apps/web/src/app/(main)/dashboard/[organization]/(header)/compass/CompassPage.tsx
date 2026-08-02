'use client'

import { CompassConversation } from '@/components/Compass/CompassConversation'
import { CompassHistoryMenu } from '@/components/Compass/CompassHistoryMenu'
import { CompassIconAction } from '@/components/Compass/CompassIconAction'
import { CompassTabs } from '@/components/Compass/CompassTabs'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { fetchCompassThread } from '@/hooks/queries'
import { useCompassAssistant } from '@/hooks/useCompassAssistant'
import AddRounded from '@mui/icons-material/AddRounded'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface CompassPageProps {
  organization: schemas['Organization']
}

export default function CompassPage({ organization }: CompassPageProps) {
  const [value, setValue] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const askedRef = useRef(false)

  const showThreadUrl = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?thread=${id}` : pathname, {
        scroll: false,
      })
    },
    [router, pathname],
  )

  const onThreadCreated = useCallback(
    (threadId: string) => {
      showThreadUrl(threadId)
      void queryClient.invalidateQueries({ queryKey: ['compass_threads'] })
    },
    [showThreadUrl, queryClient],
  )

  const [initialThreadId] = useState(() => searchParams.get('thread'))
  const { messages, send, isStreaming, reset, hydrate, threadId } =
    useCompassAssistant(organization.id, onThreadCreated, initialThreadId)

  // Hydrate only on mount / history select: reactive URL/cache hydration
  // races router.replace and resurrects conversations the user just left.
  const isStreamingRef = useRef(isStreaming)
  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])
  const loadThread = useCallback(
    async (id: string, { ifIdle = false }: { ifIdle?: boolean } = {}) => {
      try {
        const detail = await fetchCompassThread(queryClient, id)
        // Don't clobber a conversation started while the deep-link load flew.
        if (ifIdle && isStreamingRef.current) return
        hydrate(detail)
      } catch {
        // Deleted/inaccessible: reset also drops the seeded thread id.
        reset()
        showThreadUrl(null)
      }
    },
    [queryClient, hydrate, reset, showThreadUrl],
  )

  const initialLoadedRef = useRef(false)
  useEffect(() => {
    if (initialThreadId && !initialLoadedRef.current) {
      initialLoadedRef.current = true
      void loadThread(initialThreadId, { ifIdle: true })
    }
  }, [initialThreadId, loadThread])

  const startNewChat = useCallback(() => {
    reset()
    showThreadUrl(null)
    inputRef.current?.focus()
  }, [reset, showThreadUrl])

  // The overview's idle box hands its question over via `?ask=`. Send it
  // once, then strip the param so refresh and back don't re-ask.
  const ask = searchParams.get('ask')
  useEffect(() => {
    if (ask && !askedRef.current) {
      askedRef.current = true
      void send(ask)
      router.replace(pathname, { scroll: false })
    }
  }, [ask, send, router, pathname])

  // Escape returns to wherever Compass was invoked from, mirroring the old
  // overlay's close behavior. The ?ask= handoff uses router.replace, so back
  // lands on the true previous page, not an intermediate ask URL.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        router.back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  const handleAsk = (question: string) => {
    const content = question.trim()
    if (!content || isStreaming) return
    // Prefill so the input mirrors what is being asked, then send; the
    // submit clears it like a hand-typed question.
    setValue(content)
    void send(content)
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <DashboardBody
      title="Compass"
      header={
        <Box alignItems="center" columnGap="xs">
          {messages.length > 0 && (
            <CompassIconAction label="New chat" onClick={startNewChat}>
              <AddRounded style={{ fontSize: '1.125rem' }} />
            </CompassIconAction>
          )}
          <CompassHistoryMenu
            organization={organization}
            activeThreadId={threadId}
            onSelect={(selectedId) => {
              if (selectedId === threadId) return
              void loadThread(selectedId)
              showThreadUrl(selectedId)
            }}
            onDeleted={(deletedId) => {
              if (deletedId === threadId) {
                startNewChat()
              }
            }}
          />
          <Box
            as="span"
            display="block"
            width={0}
            height={20}
            marginHorizontal="s"
            borderLeftWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          />
          <CompassTabs organization={organization} active="assistant" />
        </Box>
      }
      className="h-full"
      wrapperClassName="max-w-3xl!"
    >
      <CompassConversation
        organization={organization}
        messages={messages}
        isStreaming={isStreaming}
        value={value}
        onValueChange={setValue}
        onSubmit={() => handleAsk(value)}
        onAsk={handleAsk}
        inputRef={inputRef}
      />
    </DashboardBody>
  )
}
