'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { ToolCallGroup } from '@/components/Onboarding/ToolCallGroup'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DynamicToolUIPart } from 'ai'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type MessagePart = {
  type: string
  [key: string]: unknown
}

type RenderableItem =
  | { type: 'single'; part: MessagePart; index: number }
  | { type: 'group'; parts: MessagePart[]; startIndex: number }

export const groupMessageParts = (parts: MessagePart[]): RenderableItem[] => {
  const result: RenderableItem[] = []
  let currentGroup: MessagePart[] = []
  let groupStartIndex = 0

  parts
    .filter(({ type }) => type !== 'step-start')
    .forEach((part, index) => {
      if (part.type === 'dynamic-tool') {
        if (currentGroup.length === 0) {
          groupStartIndex = index
        }
        currentGroup.push(part)
      } else {
        if (currentGroup.length > 0) {
          result.push({
            type: 'group',
            parts: currentGroup,
            startIndex: groupStartIndex,
          })
          currentGroup = []
        }
        result.push({ type: 'single', part, index })
      }
    })

  if (currentGroup.length > 0) {
    result.push({
      type: 'group',
      parts: currentGroup,
      startIndex: groupStartIndex,
    })
  }

  return result
}

export const ChatMessagePartRenderer = ({
  item,
  messageId,
  organization,
}: {
  item: RenderableItem
  messageId: string
  organization: schemas['Organization']
}) => {
  const router = useRouter()

  if (item.type === 'group') {
    return (
      <ToolCallGroup
        key={`${messageId}-group-${item.startIndex}`}
        parts={item.parts as DynamicToolUIPart[]}
        messageId={messageId}
      />
    )
  }

  const part = item.part
  const index = item.index

  if (part.type === 'text') {
    return (
      <MemoizedMarkdown
        key={`${messageId}-${index}`}
        content={part.text as string}
      />
    )
  }

  if (part.type === 'reasoning') {
    if (part.state === 'streaming') {
      return (
        <p
          key={`${messageId}-${index}`}
          className="dark:text-polar-500 animate-pulse text-sm text-gray-500 italic"
        >
          Thinking…
        </p>
      )
    }
    return null
  }

  if (part.type === 'tool-redirectToManualSetup') {
    return (
      <ManualSetupCard
        part={part}
        messageId={messageId}
        index={index}
        organization={organization}
      />
    )
  }

  if (part.type === 'tool-markAsDone') {
    return (
      <DoneCard
        part={part}
        messageId={messageId}
        index={index}
        organization={organization}
        onNavigate={(id) =>
          router.push(`/dashboard/${organization.slug}/products/${id}`)
        }
      />
    )
  }

  return null
}

const ManualSetupCard = ({
  part,
  messageId,
  index,
  organization,
}: {
  part: MessagePart
  messageId: string
  index: number
  organization: schemas['Organization']
}) => {
  if (part.state !== 'input-available' && part.state !== 'output-available') {
    return null
  }

  const reason = (
    part.input as { reason: 'unsupported_benefit_type' | 'tool_call_error' }
  ).reason

  return (
    <div
      key={`${messageId}-${index}`}
      className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-4 rounded-2xl bg-gray-100 p-4 text-center text-gray-500"
    >
      {reason === 'unsupported_benefit_type'
        ? 'Sorry, but this configuration needs manual input.'
        : reason === 'tool_call_error'
          ? 'Sorry, something went wrong.'
          : "This configuration requires manual setup. Let's continue there."}
      <Link href={`/dashboard/${organization.slug}/products/new`}>
        <Button
          variant="secondary"
          className="dark:bg-polar-700 dark:hover:bg-polar-600 rounded-full border-transparent bg-white hover:bg-white dark:border-transparent"
        >
          Configure Manually
        </Button>
      </Link>
    </div>
  )
}

const DoneCard = ({
  part,
  messageId,
  index,
  organization,
  onNavigate,
}: {
  part: MessagePart
  messageId: string
  index: number
  organization: schemas['Organization']
  onNavigate: (productId: string) => void
}) => {
  if (part.state !== 'input-available' && part.state !== 'output-available') {
    return null
  }

  const productIds = (part.input as { productIds: string[] }).productIds || []
  const firstProductId = productIds[0]

  return (
    <div
      key={`${messageId}-${index}`}
      className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-4 rounded-2xl bg-gray-100 p-4 text-center text-gray-500"
    >
      Your product{productIds.length > 1 ? 's have' : ' has'} been created!
      {firstProductId && (
        <Button
          className="dark:hover:bg-polar-50 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black"
          onClick={() => onNavigate(firstProductId)}
        >
          View Product
        </Button>
      )}
    </div>
  )
}
