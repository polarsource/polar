import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { FormEventHandler, useCallback, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export interface DescriptionEditorProps {
  description?: string
  onChange: (description: string) => void
  disabled?: boolean
  loading?: boolean
  className?: string
  size?: 'default' | 'small'
}

export const DescriptionEditor = ({
  description,
  onChange,
  disabled,
  loading,
  className,
  size = 'default',
}: DescriptionEditorProps) => {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const handleChange: FormEventHandler<HTMLParagraphElement> = useCallback(
    (e) => {
      if (!paragraphRef.current) return
      onChange((e.target as HTMLParagraphElement).innerText ?? '')
    },
    [onChange],
  )

  return (
    <div
      className={twMerge(
        'relative box-content h-fit w-full rounded-2xl border-2 border-transparent',
        disabled
          ? ''
          : 'md:dark:hover:border-polar-700 md:transition-colors md:hover:border-gray-200',
        size === 'default' ? '-m-6 p-6' : '-m-4 p-4',
      )}
    >
      <p
        ref={paragraphRef}
        className={twMerge(
          'dark:text-polar-50 w-full text-3xl !font-normal leading-normal text-gray-950 [text-wrap:pretty] focus-visible:outline-0',
          className,
        )}
        contentEditable={!disabled}
        onBlur={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      >
        {description}
      </p>

      {loading && (
        <div className="absolute right-2 top-2">
          <SpinnerNoMargin
            className={twMerge('dark:text-polar-50 h-4 w-4 text-gray-950')}
          />
        </div>
      )}
    </div>
  )
}
