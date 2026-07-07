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
