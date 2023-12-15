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

export interface EditorHelpers {
  ref: React.RefObject<HTMLTextAreaElement>
  insertText: (text: string) => void
  insertTextAtCursor: (text: string) => void
  wrapSelectionWithText: (text: [string, string]) => void
  handleChange: ChangeEventHandler<HTMLTextAreaElement>
  handleDrag: DragEventHandler<HTMLTextAreaElement>
  handleDrop: DragEventHandler<HTMLTextAreaElement>
  handlePaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void
  handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  handleDragOver: DragEventHandler<HTMLTextAreaElement>
}

export const useEditorHelpers = (
  onChange?: (value: string) => void,
): EditorHelpers => {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insertText = useCallback((text: string, fireOnChange = true) => {
    if (ref.current) {
      ref.current.value += text

      if (fireOnChange) {
        onChange?.(ref.current.value)
      }
    }
  }, [])

  const insertTextAtCursor = useCallback(
    (text: string, fireOnChange = true) => {
      if (ref.current) {
        const cursorPosition = ref.current.selectionStart

        const textBeforeCursorPosition = ref.current.value.substring(
          0,
          cursorPosition,
        )
        const textAfterCursorPosition = ref.current.value.substring(
          cursorPosition,
          ref.current.value.length,
        )

        ref.current.value =
          textBeforeCursorPosition + text + textAfterCursorPosition

        ref.current.selectionStart = cursorPosition + text.length
        ref.current.selectionEnd = cursorPosition + text.length

        if (fireOnChange) {
          onChange?.(ref.current.value)
        }
      }
    },
    [],
  )

  const wrapSelectionWithText = useCallback(
    ([before, after]: [string, string], fireOnChange = true) => {
      if (ref.current) {
        const selectionStart = ref.current.selectionStart
        const selectionEnd = ref.current.selectionEnd

        const textBeforeSelection = ref.current.value.substring(
          0,
          selectionStart,
        )

        const textInSelection = ref.current.value.substring(
          selectionStart,
          selectionEnd,
        )

        const textAfterSelection = ref.current.value.substring(
          selectionEnd,
          ref.current.value.length,
        )

        ref.current.value =
          textBeforeSelection +
          before +
          textInSelection +
          after +
          textAfterSelection

        if (fireOnChange) {
          onChange?.(ref.current.value)
        }
      }
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
            insertTextAtCursor(uploadingText, false)

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
            insertTextAtCursor(uploadingText, false)

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
        insertTextAtCursor('\t')
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
    insertText,
    insertTextAtCursor,
    wrapSelectionWithText,
    handleChange,
    handleDrag,
    handleDrop,
    handlePaste,
    handleKeyDown,
    handleDragOver,
  }
}
