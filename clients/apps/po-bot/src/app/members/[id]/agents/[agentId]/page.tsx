'use client'

import { Chat } from '@/components/Chat'
import { useParams } from 'next/navigation'

export default function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>()
  return <Chat agentId={agentId} />
}
