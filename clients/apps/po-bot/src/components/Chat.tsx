'use client'

import type { Agent } from '@/db/schema'
import { useChat } from '@ai-sdk/react'
import { Avatar, Button, Text, TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from 'ai'
import { ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'

const text = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')

const Part = ({ part }: { part: UIMessage['parts'][number] }) => {
  if (part.type === 'text') {
    if (!part.text) return null
    return <Text style={{ whiteSpace: 'pre-wrap' }}>{part.text}</Text>
  }
  if (!isToolUIPart(part)) return null
  const waiting =
    part.state !== 'output-available' && part.state !== 'output-error'
  return (
    <Text variant="caption" color="muted" monospace>
      {getToolName(part)}
      {waiting ? ' …' : part.state === 'output-error' ? ' failed' : ''}
    </Text>
  )
}

const hasParts = (message: UIMessage) =>
  message.parts.some(
    (part) => (part.type === 'text' && part.text) || isToolUIPart(part),
  )

/** Plain AI SDK chat. The route only needs the newest message; it keeps the thread. */
export const Chat = ({
  agent,
  initialMessages,
}: {
  agent: Agent
  initialMessages: UIMessage[]
}) => {
  const [draft, setDraft] = useState('')
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { agentId: agent.id, message: messages.at(-1) },
        }),
      }),
    [agent.id],
  )
  const { messages, sendMessage, status, error } = useChat({
    id: `agent-${agent.id}`,
    messages: initialMessages,
    transport,
  })
  const busy = status === 'submitted' || status === 'streaming'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setDraft('')
    void sendMessage({ text: content })
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box
        as="header"
        alignItems="center"
        columnGap="s"
        paddingHorizontal="l"
        paddingVertical="s"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Avatar
          name={agent.name}
          avatar_url={null}
          className="h-8 w-8 text-sm"
        />
        <Box flexDirection="column">
          <Text variant="label" as="h1">
            {agent.name}
          </Text>
          <Text variant="caption" color="muted" monospace>
            {agent.model}
          </Text>
        </Box>
      </Box>

      <Box
        as="ol"
        flex={1}
        flexDirection="column"
        rowGap="s"
        overflowY="auto"
        paddingHorizontal="l"
        paddingVertical="m"
      >
        {messages.length === 0 && (
          <Box as="li">
            <Text color="muted">{agent.systemPrompt || 'Say hello.'}</Text>
          </Box>
        )}
        {messages.map((message) =>
          message.role === 'user' ? (
            <Box
              as="li"
              key={message.id}
              display="flex"
              marginLeft="4xl"
              alignSelf="end"
              borderRadius="l"
              backgroundColor="background-inverse"
              paddingHorizontal="l"
              paddingVertical="s"
            >
              <Text color="inverse" style={{ whiteSpace: 'pre-wrap' }}>
                {text(message)}
              </Text>
            </Box>
          ) : (
            <Box
              as="li"
              key={message.id}
              display="flex"
              flexDirection="column"
              rowGap="xs"
              marginRight="4xl"
              alignSelf="start"
              borderRadius="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              paddingHorizontal="l"
              paddingVertical="s"
            >
              {hasParts(message) ? (
                message.parts.map((part, i) => <Part key={i} part={part} />)
              ) : (
                <Text color="muted">…</Text>
              )}
            </Box>
          ),
        )}
        {error && (
          <Box
            as="li"
            display="flex"
            marginRight="4xl"
            borderRadius="l"
            backgroundColor="background-danger"
            paddingHorizontal="l"
            paddingVertical="s"
          >
            <Text color="danger">{error.message}</Text>
          </Box>
        )}
      </Box>

      <Box
        as="form"
        onSubmit={submit}
        alignItems="end"
        columnGap="s"
        padding="s"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <TextArea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) submit(event)
          }}
          placeholder={`Message ${agent.name}`}
          rows={1}
          resizable={false}
          className="min-h-9 flex-1 px-3 py-2 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9"
          disabled={busy || !draft.trim()}
        >
          <ArrowUp size={14} />
        </Button>
      </Box>
    </Box>
  )
}
