import { upload } from '@vercel/blob/client'
import { TextArea } from 'polarkit/components/ui/atoms'
import { ChangeEventHandler, DragEventHandler, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const uploadingText = 'Uploading...'

interface MarkdownEditorProps {
  className?: string
  value: string
  onChange?: (value: string) => void
}

export const MarkdownEditor = ({
  value,
  className,
  onChange,
}: MarkdownEditorProps) => {
  const insertTextAtCursor = useCallback(
    (text: string, element: HTMLTextAreaElement) => {
      const cursorPosition = element.selectionStart

      const textBeforeCursorPosition = element.value.substring(
        0,
        cursorPosition,
      )
      const textAfterCursorPosition = element.value.substring(
        cursorPosition,
        element.value.length,
      )

      element.value = textBeforeCursorPosition + text + textAfterCursorPosition
    },
    [],
  )

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      onChange?.(e.target.value)
    },
    [onChange],
  )

  const handleDrag: DragEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop: DragEventHandler<HTMLTextAreaElement> = useCallback(
    async (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        e.preventDefault()
        e.stopPropagation()

        for (const file of e.dataTransfer.files) {
          try {
            insertTextAtCursor(uploadingText, e.target)

            const newBlob = await upload(file.name, file, {
              access: 'public',
              handleUploadUrl: '/api/blob/upload',
            })

            const textToInsert = `![${newBlob.pathname}](${newBlob.url})`

            e.target.value = e.target.value.replace(uploadingText, textToInsert)
          } catch (err) {
            e.target.value = e.target.value.replace(uploadingText, '')
          } finally {
            onChange?.(e.target.value)
          }
        }
      }
    },
    [onChange, insertTextAtCursor],
  )

  const allow: DragEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return (
    <TextArea
      className={twMerge(
        'h-full min-h-[600px] rounded-3xl p-6 text-lg',
        className,
      )}
      placeholder="# Hello World!"
      resizable={false}
      value={value}
      onChange={handleChange}
      onDrop={handleDrop}
      onDrag={handleDrag}
      onDragOver={allow}
    />
  )
}
