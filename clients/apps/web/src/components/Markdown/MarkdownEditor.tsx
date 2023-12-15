import { TextArea } from 'polarkit/components/ui/atoms'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { useEditorHelpers } from './useEditorHelpers'

const uploadingText = 'Uploading...'

interface MarkdownEditorProps {
  className?: string
  value: string
  onChange?: (value: string) => void
  autoFocus?: boolean
}

export const MarkdownEditor = ({
  value,
  className,
  onChange,
  autoFocus,
}: MarkdownEditorProps) => {
  const {
    ref,
    handleChange,
    handleDrag,
    handleDragOver,
    handleDrop,
    handleKeyDown,
    handlePaste,
  } = useEditorHelpers(onChange)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])

  return (
    <TextArea
      ref={ref}
      className={twMerge(
        'h-screen min-h-screen rounded-3xl p-6 text-lg',
        className,
      )}
      placeholder="# Hello World!"
      resizable={false}
      value={value}
      onChange={handleChange}
      onDrop={handleDrop}
      onDrag={handleDrag}
      onDragOver={handleDragOver}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      autoFocus={autoFocus}
    />
  )
}
