import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Paperclip, Send } from 'lucide-react'
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AttachmentChips } from './AttachmentChips'
import { type ChatUploader } from './types'
import { useAttachmentUploads } from './useAttachmentUploads'

const MAX_LENGTH = 5000

export interface ComposerHandle {
  addFiles: (files: File[]) => void
}

interface Props {
  uploader: ChatUploader
  onSend: (text: string, fileIds: string[]) => Promise<{ error?: unknown }>
  isSendPending: boolean
  placeholder?: string
  minTextLength?: number
  showMinimumCharCounter?: boolean
  allowAttachments?: boolean
  ref?: React.Ref<ComposerHandle>
}

export const Composer = ({
  uploader,
  onSend,
  isSendPending,
  placeholder = 'Write a reply…',
  minTextLength = 1,
  showMinimumCharCounter = false,
  allowAttachments = true,
  ref,
}: Props) => {
  const [body, setBody] = useState('')
  const [flying, setFlying] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)

  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    attachments,
    attachmentError,
    addFiles,
    removeAttachment,
    clearAttachments,
    uploadsPending,
    uploadsFailed,
    uploadedFileIds,
  } = useAttachmentUploads(uploader)

  const length = body.length
  const hasValidText =
    body.trim().length >= minTextLength && length <= MAX_LENGTH
  const hasContent =
    hasValidText || (allowAttachments && uploadedFileIds.length > 0)

  const canSend = hasContent && !uploadsPending && !uploadsFailed
  const busy = isSendPending || sending

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))

    e.target.value = ''
  }

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles])

  const submit = async () => {
    if (!canSend || busy) return
    setSending(true)
    setFlying(true)
    setSendFailed(false)

    try {
      const result = await onSend(body, uploadedFileIds)
      if (result.error) {
        setFlying(false)
        setSendFailed(true)
        return
      }
      setBody('')
      clearAttachments()
    } catch {
      setFlying(false)
      setSendFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      <div className="flex items-end gap-2">
        {allowAttachments && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={uploader.accept}
              multiple
              onChange={onFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label="Attach files"
              className="dark:text-polar-400 dark:hover:text-polar-200 mb-2 ml-[-10px] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-gray-500 transition-colors hover:text-gray-900 disabled:cursor-default disabled:opacity-30"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </>
        )}
        <div className="dark:border-polar-700 dark:bg-polar-800 relative flex-1 rounded-2xl border border-gray-200 bg-white">
          <AnimatePresence initial={false}>
            {attachments.length > 0 && (
              <motion.div
                key="attachment-chips"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <AttachmentChips
                  attachments={attachments}
                  onRemove={removeAttachment}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              if (sendFailed) setSendFailed(false)
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={placeholder}
            maxLength={MAX_LENGTH}
            className="dark:text-polar-50 block max-h-[240px] w-full resize-none overflow-y-auto border-0 bg-transparent py-3 pr-12 pl-4 text-sm leading-5 text-gray-900 shadow-none ring-0 outline-none placeholder:text-gray-400 focus:border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend || busy}
            aria-label="Send"
            className="dark:bg-polar-50 dark:text-polar-900 dark:hover:bg-polar-200 dark:disabled:hover:bg-polar-50 absolute right-2 bottom-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-gray-900"
          >
            {busy && !flying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Box position="relative" top={0.5} right={1}>
                <Send
                  className={`h-4 w-4 ${flying ? 'animate-send-off' : ''}`}
                  onAnimationEnd={() => setFlying(false)}
                />
              </Box>
            )}
          </button>
        </div>
      </div>
      {attachmentError && (
        <Text variant="caption" color="danger" align="center">
          {attachmentError}
        </Text>
      )}
      {sendFailed && (
        <Text variant="caption" color="danger" align="center">
          Couldn&rsquo;t send your message — please try again.
        </Text>
      )}
      {showMinimumCharCounter && (
        <div className="flex gap-2">
          {allowAttachments && <div className="ml-[-10px] w-8 shrink-0" />}
          <Box display="flex" flexGrow={1} justifyContent="between">
            <Text variant="caption" color="muted">
              Minimum {minTextLength} characters
            </Text>
            <Text variant="caption" color="muted">
              {length}/{MAX_LENGTH}
            </Text>
          </Box>
        </div>
      )}
    </Box>
  )
}
