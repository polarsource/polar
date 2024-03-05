'use client'

import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { type PutBlobResult } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ImageUpload = ({
  onUploaded,
  validate,
  defaultValue,
  height,
  width,
}: {
  onUploaded: (url: string) => void
  validate?: (el: HTMLImageElement) => string | undefined
  defaultValue?: string
  height?: number
  width?: number
}) => {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [blob, setBlob] = useState<PutBlobResult | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | undefined>(
    defaultValue,
  )

  const [isLoading, setIsLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const handleUpload = async () => {
    if (!inputFileRef.current?.files) {
      throw new Error('No file selected')
    }

    const file = inputFileRef.current.files[0]

    setIsLoading(true)
    setErrorMessage(undefined)

    try {
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      })
      setBlob(newBlob)
      onUploaded(newBlob.url)
    } catch (e) {
      setErrorMessage('Failed to upload image')
    } finally {
      setIsLoading(false)
    }
  }

  const onLoad = (e: React.ChangeEvent<HTMLImageElement>) => {
    if (validate) {
      const res = validate(e.currentTarget)
      setErrorMessage(res)
    }
  }

  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (validate && imageRef.current) {
      const res = validate(imageRef.current)
      setErrorMessage(res)
    }
  }, [height, width, validate, imageRef])

  return (
    <>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          await handleUpload()
        }}
      >
        <input
          style={{ display: 'none', height: 0 }}
          name="file"
          ref={inputFileRef}
          type="file"
          required
          accept="image/*"
          onChange={async (e) => {
            if (e.target.files && e.target.files[0]) {
              const reader = new FileReader()
              reader.onload = (readerLoad) => {
                if (
                  readerLoad.target &&
                  typeof readerLoad.target.result === 'string'
                ) {
                  setImagePreviewSrc(readerLoad.target.result)
                }
              }
              reader.readAsDataURL(e.target.files[0])
              await handleUpload()
            } else {
              setImagePreviewSrc(undefined)
            }
          }}
        />

        <div className="flex flex-col items-start gap-4">
          {imagePreviewSrc ? (
            <div className="relative">
              <img
                ref={imageRef}
                src={imagePreviewSrc}
                className={twMerge(
                  'flex cursor-pointer items-center justify-center rounded-xl border border-gray-100 bg-gray-50 object-cover hover:opacity-80',
                  isLoading ? 'opacity-50' : '',
                  errorMessage ? 'border-red-500' : '',
                  !height && !width ? 'h-32 w-32' : '',
                )}
                onClick={(e) => {
                  inputFileRef.current?.click()
                }}
                onLoad={onLoad}
                height={height}
                width={width}
              />
              {isLoading ? (
                <div className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center">
                  <SpinnerNoMargin />
                </div>
              ) : null}
            </div>
          ) : (
            <div
              onClick={(e) => {
                inputFileRef.current?.click()
              }}
              className={twMerge(
                'dark:bg-polar-700 dark:border-polar-600 flex cursor-pointer flex-col items-center justify-center gap-y-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100',
                !height && !width ? 'h-32 w-32' : '',
              )}
              style={{
                maxWidth: width,
                maxHeight: height,
                width: width && height ? '100%' : undefined,
                aspectRatio: `${width} / ${height}`,
              }}
            >
              <PhotoIcon className="h-6 w-6 text-gray-600" />
              {height && width ? (
                <div className="text-xs text-gray-600">
                  {height} x {width}px
                </div>
              ) : null}
            </div>
          )}

          {errorMessage ? (
            <div className="text-sm text-red-500">{errorMessage}</div>
          ) : null}
        </div>
      </form>
    </>
  )
}

export default ImageUpload
