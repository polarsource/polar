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
      return `${speaker}: ${text}`
    })
    .filter((line): line is string => line !== null)
    .join('\n\n')
