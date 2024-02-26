import { TextArea } from 'polarkit/components/ui/atoms'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { abbreviatedContent } from '../Feed/Markdown/BrowserRender'
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

  const [editorScrollWidth, setEditorScrollWidth] = useState(0)

  const resizeTextarea = async () => {
    if (bodyRef?.current) {
      const currentWidth = bodyRef.current.scrollWidth

      // If textarea is wider than before. Reset element height before using scrollHeight.
      // This allows the textarea height to shrink
      if (currentWidth > editorScrollWidth) {
        bodyRef.current.style.height = ''
      }

      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'

      setEditorScrollWidth(currentWidth)
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

  // Calculate size of preview section
  const [previewRef, setPreviewRef] = useState<HTMLDivElement | null>(null)
  const [previewHeight, setPreviewHeight] = useState(0)
  useEffect(() => {
    if (!previewRef) {
      return
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        console.log(e)
        setPreviewHeight(e.borderBoxSize[0].blockSize)
      }
    })
    resizeObserver.observe(previewRef)

    return () => {
      resizeObserver.unobserve(previewRef)
    }
  }, [previewRef])

  const previewContent = abbreviatedContent(value)
  const showPreviewArea = previewContent !== value.trimEnd()

  console.log(previewContent)

  return (
    <div className="relative">
      <TextArea
        ref={bodyRef}
        className={twMerge('z-10 rounded-3xl p-6 text-lg', className)}
        style={{
          minHeight: '100vh',
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

      {showPreviewArea ? (
        <div
          className="absolute -left-8 top-0 hidden xl:block"
          style={{
            height: previewHeight,
          }}
        >
          <div className="dark:text-polar-500 flex h-full w-8 flex-col items-center text-gray-300">
            <div className="dark:bg-polar-500 w-[2px] flex-1 bg-gray-300"></div>
            <div>
              <div className="dark:bg-polar-900 -rotate-90 bg-white px-2 text-xs">
                Preview
              </div>
            </div>
            <div className="dark:bg-polar-500 w-[2px] flex-1 bg-gray-300"></div>
          </div>
        </div>
      ) : null}

      {/* Render the abbreviated article contents in a similarly styled div as the textarea.
        This is used to calculate the "height" of the input-content that will be used in previews.
      */}
      <div className="w-full overflow-x-hidden">
        <div
          className={twMerge(
            'absolute left-[200000px] top-0 z-0 overflow-hidden whitespace-pre-wrap rounded-3xl !bg-blue-200 p-6 text-lg',
            className,
          )}
          style={{
            width: editorScrollWidth,
          }}
          ref={setPreviewRef}
        >
          {previewContent}
        </div>
      </div>
    </div>
  )
}
