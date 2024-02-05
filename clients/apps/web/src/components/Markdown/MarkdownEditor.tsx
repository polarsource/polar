import { TextArea } from 'polarkit/components/ui/atoms'
import { useContext, useEffect, useRef } from 'react'
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

  const editorScrollWidth = useRef(0)

  const resizeTextarea = async () => {
    if (bodyRef?.current) {
      const currentWidth = bodyRef.current.scrollWidth

      // If textarea is wider than before. Reset element height before using scrollHeight.
      // This allows the textarea height to shrink
      if (currentWidth > editorScrollWidth.current) {
        bodyRef.current.style.height = ''
      }

      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'

      editorScrollWidth.current = currentWidth
    }
  }

  // Run on value change
  useEffect(() => {
    resizeTextarea()
  }, [value])

  // Run once
  useEffect(() => {
    resizeTextarea()
  }, [])

  // Run on window resized
  useEffect(() => {
    window.addEventListener('resize', resizeTextarea)
    return () => {
      window.removeEventListener('resize', resizeTextarea)
    }
  }, [])

  return (
    <TextArea
      ref={bodyRef}
      className={twMerge('rounded-3xl p-6 text-lg', className)}
      style={{
        minHeight: '100vw',
      }}
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
