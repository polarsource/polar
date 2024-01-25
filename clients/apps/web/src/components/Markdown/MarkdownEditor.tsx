import { TextArea } from 'polarkit/components/ui/atoms'
import { useContext, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { PostEditorContext } from '../Feed/PostEditor'

const uploadingText = 'Uploading...'

interface MarkdownEditorProps {
  className?: string
  value: string
  autoFocus?: boolean
  disabled?: boolean
}

export const MarkdownEditor = ({
  value,
  className,
  autoFocus,
  disabled,
}: MarkdownEditorProps) => {
  const {
    ref,
    handleChange,
    handleDrag,
    handleDragOver,
    handleDrop,
    handleKeyDown,
    handlePaste,
  } = useContext(PostEditorContext)

  useEffect(() => {
    if (ref?.current) {
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
      disabled={disabled}
    />
  )
}
