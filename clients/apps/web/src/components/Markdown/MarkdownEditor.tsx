import { TextArea } from 'polarkit/components/ui/atoms'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { abbreviatedContent } from '../Feed/Markdown/BrowserRender'
import { PostEditorContext } from '../Feed/PostEditor'

interface MarkdownEditorProps {
  className?: string
  value: string
  autoFocus?: boolean
  disabled?: boolean
  isPaidArticle: boolean
}

export const MarkdownEditor = ({
  value,
  className,
  autoFocus,
  disabled,
  isPaidArticle,
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
        setPreviewHeight(e.borderBoxSize[0].blockSize)
      }
    })
    resizeObserver.observe(previewRef)

    return () => {
      resizeObserver.unobserve(previewRef)
    }
  }, [previewRef])

  const previewContent = abbreviatedContent(value)
  const showPreviewArea = previewContent.body !== value.trimEnd()
  const previewRulerTop = previewContent.manualBoundary
    ? previewHeight - 14
    : previewHeight + 6

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
        <>
          <div
            className="pointer-events-none absolute -left-[30px] z-0 flex select-none items-center justify-center border-t-[2px] border-dashed "
            style={{
              top: previewRulerTop,
              width: previewContent.manualBoundary ? 30 - 20 : 30 - 2,
            }}
          ></div>

          <div
            className="pointer-events-none absolute -right-[30px] z-0 flex select-none items-center justify-center border-t-[2px] border-dashed "
            style={{
              top: previewRulerTop,
              left: previewContent.manualBoundary
                ? (previewContent.matchedBoundary ?? '').length * 8 + 20
                : 0,
            }}
          ></div>

          <div
            className="absolute"
            style={{
              top: previewRulerTop - 6,
              left: (editorScrollWidth - 240) / 2,
            }}
          >
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="dark:bg-polar-800 w-[240px] select-none rounded-b-md bg-gray-100 px-4 text-center text-xs text-gray-400">
                    {isPaidArticle
                      ? 'FREE PREVIEW ABOVE'
                      : 'PREVIEW SECTION ABOVE'}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="flex max-w-[300px] flex-col gap-2"
                >
                  <p>
                    This section will be used as the post preview in list views,
                    and as the free introduction in premium posts.
                  </p>
                  <p>
                    You can customize the section that will be used as the
                    preview by adding a <code>---</code> divider where you want
                    the section to end.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      ) : null}

      {/* Render the abbreviated article contents in a similarly styled div as the textarea.
        This is used to calculate the "height" of the input-content that will be used in previews.
      */}
      <div>
        <div
          className={twMerge(
            'absolute left-0 top-0 z-0 overflow-hidden whitespace-pre-wrap rounded-3xl p-6 text-lg',
            className,
            'pointer-events-none select-none bg-transparent text-transparent',
          )}
          style={{
            width: editorScrollWidth,
          }}
          ref={setPreviewRef}
        >
          {previewContent.body}
        </div>
      </div>
    </div>
  )
}
