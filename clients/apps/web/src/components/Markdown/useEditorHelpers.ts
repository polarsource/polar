import { upload } from '@vercel/blob/client'
import {
  ChangeEventHandler,
  ClipboardEvent,
  DragEventHandler,
  KeyboardEventHandler,
  useCallback,
  useRef,
} from 'react'

const uploadingText = 'Uploading...'

export const useEditorHelpers = (onChange?: (value: string) => void) => {
  const ref = useRef<HTMLTextAreaElement>(null)

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

      element.selectionStart = cursorPosition + text.length
      element.selectionEnd = cursorPosition + text.length
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

  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLTextAreaElement>) => {
      if (e.target instanceof HTMLTextAreaElement) {
        if (e.clipboardData.files.length > 0) {
          e.preventDefault()
          e.stopPropagation()
        }

        for (const file of e.clipboardData.files) {
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

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      /** Handle tab presses */
      if (e.key == 'Tab' && e.target instanceof HTMLTextAreaElement) {
        e.preventDefault()
        insertTextAtCursor('\t', e.target)
        onChange?.(e.target.value)
      }
    },
    [onChange, insertTextAtCursor],
  )

  const handleDragOver: DragEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
    },
    [],
  )

  return {
    ref,
    handleChange,
    handleDrag,
    handleDrop,
    handlePaste,
    handleKeyDown,
    handleDragOver,
  }
}
