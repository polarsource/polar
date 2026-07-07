'use client'

import { CompassConversation } from '@/components/Compass/CompassConversation'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCompassAssistant } from '@/hooks/useCompassAssistant'
import { schemas } from '@polar-sh/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface CompassPageProps {
  organization: schemas['Organization']
}

export default function CompassPage({ organization }: CompassPageProps) {
  const [value, setValue] = useState('')
  const { messages, send, isStreaming } = useCompassAssistant(organization.id)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const askedRef = useRef(false)

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
    void send(content)
    setValue('')
  }

  return (
    <DashboardBody title="Compass" className="h-full">
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
