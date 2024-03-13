import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

export interface DescriptionEditorProps {
  description?: string
  onChange: (description: string) => void
  disabled?: boolean
  loading?: boolean
}

export const DescriptionEditor = ({
  description,
  onChange,
  disabled,
  loading,
}: DescriptionEditorProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [internalDescription, setInternalDescription] = useState(description)

  const resizeTextarea = useCallback(() => {
    if (inputRef?.current) {
      inputRef.current.style.height = ''
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
    }
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [internalDescription, resizeTextarea])

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      setInternalDescription(e.target.value ?? '')
      onChange(e.target.value ?? '')
    },
    [onChange],
  )

  useEffect(() => {
    window.addEventListener('resize', resizeTextarea)
    return () => {
      window.removeEventListener('resize', resizeTextarea)
    }
  }, [resizeTextarea])

  return (
    <div
      className={twMerge(
        'relative -m-6 box-content h-fit w-full rounded-2xl border-2 border-transparent p-6',
        disabled
          ? ''
          : 'md:dark:hover:border-polar-700 md:transition-colors md:hover:border-gray-200',
      )}
    >
      <textarea
        ref={inputRef}
        className="dark:text-polar-50 hidden h-[2.8rem] w-full resize-none border-none bg-transparent p-0 text-3xl !font-normal leading-normal text-gray-950 outline-none focus:ring-0 md:block"
        value={internalDescription}
        onChange={handleChange}
        disabled={disabled}
      />
      <p className="dark:text-polar-50 block w-full text-3xl !font-normal leading-normal text-gray-950 md:hidden">
        {internalDescription}
      </p>
      {loading && (
        <div className="absolute bottom-4 right-4">
          <SpinnerNoMargin className="dark:text-polar-50 h-4 w-4 text-gray-950" />
        </div>
      )}
    </div>
  )
}
