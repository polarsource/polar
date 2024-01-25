import { TextArea } from 'polarkit/components/ui/atoms'
import { useContext, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { PostEditorContext } from '../Feed/PostEditor'

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
    bodyRef,
    handleChange,
    handleDrag,
    handleDragOver,
    handleDrop,
    handleKeyDown,
    handlePaste,
  } = useContext(PostEditorContext)

  useEffect(() => {
    if (bodyRef?.current) {
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'
    }
  }, [value])

  return (
    <TextArea
      ref={bodyRef}
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
