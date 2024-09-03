import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { FormEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface DescriptionEditorProps {
  description?: string
  onChange: (description: string) => void
  disabled?: boolean
  loading?: boolean
  failed?: boolean
  className?: string
  size?: 'default' | 'small'
  maxLength: number
}

export const DescriptionEditor = ({
  description,
  onChange,
  disabled,
  loading,
  failed,
  className,
  size = 'default',
  maxLength,
}: DescriptionEditorProps) => {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const [isDirty, setIsDirty] = useState(false)
  const [contentLength, setContentLength] = useState(description?.length ?? 0)
  const [isFocused, setFocused] = useState(false)

  const onBlur: FormEventHandler<HTMLParagraphElement> = useCallback(
    (e) => {
      if (!paragraphRef.current) return
      setIsDirty(false)
      onChange((e.target as HTMLParagraphElement).innerText ?? '')
      setFocused(false)
    },
    [onChange],
  )

  const onEditableChanged: FormEventHandler<HTMLParagraphElement> = (e) => {
    if (!paragraphRef.current) return
    const content = (e.target as HTMLParagraphElement).innerText ?? ''
    setIsDirty(true)
    setContentLength(content.length)
  }

  const showLength = isDirty || contentLength > maxLength

  // If user is not authored to edit description and description is empty, do not render
  if (disabled && !description) {
    return null
  }

  return (
    <div
      className={twMerge(
        'relative box-content h-fit w-full rounded-2xl border-2 border-transparent',
        disabled
          ? ''
          : 'md:dark:hover:border-polar-700 md:transition-colors md:hover:border-gray-200',
        failed ? '!border-red-400' : '',
        size === 'default' ? '-m-6 p-6' : '-m-4 p-4',
        description?.length === 0 && !disabled && 'italic',
      )}
    >
      <p
        ref={paragraphRef}
        className={twMerge(
          'w-full text-pretty break-words text-3xl !font-normal leading-normal text-gray-950 focus-visible:outline-0 dark:text-white',
          showLength ? 'pb-4' : '',
          className,
        )}
        suppressContentEditableWarning={true}
        contentEditable={!disabled}
        onBlur={onBlur}
        onKeyDown={(e) => {
          onEditableChanged(e)
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
        onFocus={() => setFocused(true)}
      >
        {description?.length === 0 && !disabled && !isFocused
          ? 'Add profile description...'
          : description}
      </p>

      {showLength ? (
        <div
          className={twMerge(
            'text-gray absolute bottom-2 right-2 text-xs',
            contentLength > maxLength ? 'text-red-500' : 'text-gray-500',
          )}
        >
          {contentLength}/{maxLength}
        </div>
      ) : null}

      {loading ? (
        <div className="absolute right-2 top-2">
          <SpinnerNoMargin
            className={twMerge('h-4 w-4 text-gray-950 dark:text-white')}
          />
        </div>
      ) : null}
    </div>
  )
}
