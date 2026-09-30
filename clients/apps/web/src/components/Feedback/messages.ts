import type { UIMessage } from 'ai'

export const extractText = (message: UIMessage): string =>
  message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')

export const buildTranscript = (messages: UIMessage[]): string =>
  messages
    .map((message) => {
      const text = extractText(message).trim()
      if (!text) return null
      const speaker = message.role === 'user' ? 'User' : 'Assistant'
      return `**${speaker}**\n\n${text}`
    })
    .filter((line): line is string => line !== null)
    .join('\n\n')

export const MAX_FEEDBACK_MESSAGE_LENGTH = 5000
export const MAX_ESCALATION_NOTE_LENGTH = 2000

const TRUNCATION_MARKER = '\n\n[… transcript truncated …]\n\n'

const truncateMiddle = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  const available = Math.max(maxLength - TRUNCATION_MARKER.length, 0)
  const headLength = Math.ceil(available / 2)
  const tailLength = available - headLength
  return `${text.slice(0, headLength)}${TRUNCATION_MARKER}${text.slice(text.length - tailLength)}`
}

export const buildEscalationMessage = (
  note: string,
  messages: UIMessage[],
): string => {
  const trimmed = note.trim().slice(0, MAX_ESCALATION_NOTE_LENGTH)
  const prefix = trimmed
    ? `${trimmed}\n\n---\n\n## Transcript\n\n`
    : '## Transcript\n\n'
  const transcript = truncateMiddle(
    buildTranscript(messages),
    MAX_FEEDBACK_MESSAGE_LENGTH - prefix.length,
  )
  return `${prefix}${transcript}`
}
