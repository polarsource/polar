import { upload } from '@vercel/blob/client'
import { TextArea } from 'polarkit/components/ui/atoms'
import { ChangeEventHandler, DragEventHandler, useCallback } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange?: (value: string) => void
}

export const MarkdownEditor = ({ value, onChange }: MarkdownEditorProps) => {
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
            const newBlob = await upload(file.name, file, {
              access: 'public',
              handleUploadUrl: '/api/blob/upload',
            })

            const textToInsert = `![${newBlob.pathname}](${newBlob.url})`
            const cursorPosition = e.target.selectionStart

            const textBeforeCursorPosition = e.target.value.substring(
              0,
              cursorPosition,
            )
            const textAfterCursorPosition = e.target.value.substring(
              cursorPosition,
              e.target.value.length,
            )

            onChange?.(
              textBeforeCursorPosition + textToInsert + textAfterCursorPosition,
            )
          } catch (err) {}
        }
      }
    },
    [onChange],
  )

  const allow: DragEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return (
    <TextArea
      className="h-full min-h-[600px] rounded-3xl p-6 text-lg"
      resizable={false}
      value={value}
      onChange={handleChange}
      onDrop={handleDrop}
      onDrag={handleDrag}
      onDragOver={allow}
    />
  )
}
