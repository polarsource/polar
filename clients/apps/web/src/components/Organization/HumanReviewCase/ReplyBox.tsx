import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Loader2, Send } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

interface Props {
  onSend: (text: string) => Promise<{ error?: unknown }>
  isPending: boolean
  minLength?: number
  placeholder?: string
}

export const ReplyBox = ({
  onSend,
  isPending,
  minLength = 1,
  placeholder = 'Write a reply…',
}: Props) => {
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const length = body.length
  const canSend = body.trim().length >= minLength && length <= 5000

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  const submit = async () => {
    if (!canSend) return
    const result = await onSend(body)
    if (!result.error) setBody('')
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      <div className="dark:border-polar-700 dark:bg-polar-800 relative rounded-2xl border border-gray-200 bg-white">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder={placeholder}
          maxLength={5000}
          className="dark:text-polar-50 block max-h-[72px] w-full resize-none overflow-y-auto border-0 bg-transparent py-3 pr-12 pl-4 text-sm leading-5 text-gray-900 shadow-none ring-0 outline-none placeholder:text-gray-400 focus:border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
        />
        <Box transform="translate(2px, 2px)">
          <button
            type="button"
            onClick={submit}
            disabled={!canSend || isPending}
            aria-label="Send"
            className="dark:bg-polar-50 dark:text-polar-900 absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity disabled:opacity-30"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Box position="relative" top={0.5} right={1}>
                <Send className="h-4 w-4" />
              </Box>
            )}
          </button>
        </Box>
      </div>
      {minLength > 1 && (
        <Box display="flex" justifyContent="between" paddingHorizontal="s">
          <Text variant="caption" color="muted">
            Minimum {minLength} characters
          </Text>
          <Text variant="caption" color="muted">
            {length}/5000
          </Text>
        </Box>
      )}
    </Box>
  )
}
