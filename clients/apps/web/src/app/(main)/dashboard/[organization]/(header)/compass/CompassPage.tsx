'use client'

import { CompassConversation } from '@/components/Compass/CompassConversation'
import { CompassHistoryMenu } from '@/components/Compass/CompassHistoryMenu'
import { CompassIconAction } from '@/components/Compass/CompassIconAction'
import { CompassTabs } from '@/components/Compass/CompassTabs'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCompassAssistant } from '@/hooks/useCompassAssistant'
import AddRounded from '@mui/icons-material/AddRounded'
import { schemas } from '@polar-sh/client'
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

  const showThreadUrl = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?thread=${id}` : pathname, {
        scroll: false,
      })
    },
    [router, pathname],
  )

  const [initialThreadId] = useState(() => searchParams.get('thread'))
  const { messages, send, isStreaming, threadId, selectThread, newChat } =
    useCompassAssistant({
      organizationId: organization.id,
      initialThreadId,
      onThreadChange: showThreadUrl,
    })

  const startNewChat = useCallback(() => {
    newChat()
    inputRef.current?.focus()
  }, [newChat])

  // The overview's idle box hands its question over via `?ask=`. Send it
  // once, then strip the param so refresh and back don't re-ask.
  const ask = searchParams.get('ask')
  // Escape returns to wherever Compass was invoked from, mirroring the old
  // overlay's close behavior. The ?ask= handoff uses router.replace, so back
  // lands on the true previous page, not an intermediate ask URL.
  useEffect(() => {
    if (ask && !askedRef.current) {
      askedRef.current = true
      void send(ask)
      router.replace(pathname, { scroll: false })
    }
  }, [ask, send, router, pathname])

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
            onSelect={selectThread}
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
