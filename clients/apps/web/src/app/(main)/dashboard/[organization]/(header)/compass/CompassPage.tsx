'use client'

import { CompassConversation } from '@/components/Compass/CompassConversation'
import { CompassHistoryMenu } from '@/components/Compass/CompassHistoryMenu'
import { CompassTabs } from '@/components/Compass/CompassTabs'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCompassThread } from '@/hooks/queries'
import { useCompassAssistant } from '@/hooks/useCompassAssistant'
import AddRounded from '@mui/icons-material/AddRounded'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const askedRef = useRef(false)

  // The `?thread=` param is the source of truth for deep links and
  // refreshes; the hook's threadId tracks what is actually on screen, so a
  // param change triggers exactly one rehydration and a freshly created
  // thread doesn't re-fetch itself.
  const threadParam = searchParams.get('thread')

  const onThreadCreated = useCallback(
    (threadId: string) => {
      router.replace(`${pathname}?thread=${threadId}`, { scroll: false })
    },
    [router, pathname],
  )

  const { messages, send, isStreaming, reset, hydrate, threadId } =
    useCompassAssistant(organization.id, onThreadCreated)

  const { data: threadDetail } = useCompassThread(
    threadParam && threadParam !== threadId ? threadParam : null,
  )
  useEffect(() => {
    if (threadDetail && threadDetail.id !== threadId) {
      hydrate(threadDetail)
    }
  }, [threadDetail, threadId, hydrate])

  const startNewChat = useCallback(() => {
    reset()
    router.replace(pathname, { scroll: false })
    inputRef.current?.focus()
  }, [reset, router, pathname])

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
        <Box alignItems="center" columnGap="s">
          {messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={startNewChat}>
              <Box alignItems="center" columnGap="xs">
                <AddRounded style={{ fontSize: '1rem' }} />
                New chat
              </Box>
            </Button>
          )}
          <CompassHistoryMenu
            organization={organization}
            activeThreadId={threadId}
            onSelect={(selectedId) => {
              if (selectedId === threadId) return
              router.replace(`${pathname}?thread=${selectedId}`, {
                scroll: false,
              })
            }}
            onDeleted={(deletedId) => {
              if (deletedId === threadId) {
                startNewChat()
              }
            }}
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
