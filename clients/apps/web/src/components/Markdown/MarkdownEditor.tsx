import { ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/20/solid'
import { TextArea } from 'polarkit/components/ui/atoms'
import { useContext, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PostEditorContext } from '../Feed/PostEditor'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
import { abbreviatedContent } from '../Feed/Markdown/BrowserRender'

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
            className="absolute -left-8 top-0 hidden  "
            style={{
              height: previewHeight,
            }}
          >
            <div className="dark:text-polar-500 flex h-full w-8 flex-col items-center text-gray-400">
              <div className="dark:bg-polar-500 w-[1px] flex-1 bg-gray-300"></div>
              <div className="hidden xl:block">
                <div className="dark:bg-polar-900 py-2 text-xs">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex cursor-pointer flex-col items-center font-mono">
                          <InformationCircleIcon className="h-4 w-4" />

                          {previewHeight > 180 ? (
                            <>
                              <span className="mt-2">P</span>
                              <span>R</span>
                              <span>E</span>
                              <span>V</span>
                              <span>I</span>
                              <span>E</span>
                              <span>W</span>
                            </>
                          ) : null}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="flex max-w-[300px] flex-col gap-2"
                      >
                        <p>
                          This section will be used as the post preview in list
                          views, and as the free introduction in premium posts.
                        </p>
                        <p>
                          You can customize the section that will be used as the
                          preview by adding a <code>&lt;hr&gt;</code>-tag where
                          you want the section to end.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="dark:bg-polar-500 w-[1px] flex-1 bg-gray-300"></div>
            </div>
          </div>
          <div
            className="absolute -left-8 flex select-none items-center text-center text-xs text-gray-400"
            style={{
              top: previewContent.manualBoundary
                ? previewHeight + 6
                : previewHeight,
              color: previewContent.manualBoundary ? 'green' : 'red',
            }}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </div>
          <div
            className="absolute -right-8  text-gray-400"
            style={{
              top: previewContent.manualBoundary
                ? previewHeight + 34
                : previewHeight,
              color: previewContent.manualBoundary ? 'green' : 'red',
            }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </div>
        </>
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
<<<<<<< HEAD
          {previewContent}
=======
          {previewContent.body}
>>>>>>> 7738a7960 (lol)
        </div>
      </div>
    </div>
  )
}
