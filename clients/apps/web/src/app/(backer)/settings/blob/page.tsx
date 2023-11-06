'use client'

import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { type PutBlobResult } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function AvatarUploadPage() {
  const [url, setUrl] = useState<string | undefined>()

  return (
    <>
      <h1>Test Blob Uploads</h1>

      <ImageUpload onUploaded={setUrl} />

      {url && (
        <div>
          Blob url: <a href={url}>{url}</a>
        </div>
      )}
    </>
  )
}

const ImageUpload = ({ onUploaded }: { onUploaded: (url: string) => void }) => {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [blob, setBlob] = useState<PutBlobResult | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | undefined>()

  const canUpload = imagePreviewSrc

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

  return (
    <>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          await handleUpload()
        }}
      >
        <input
          style={{ visibility: 'hidden' }}
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

        <div className="flex items-end gap-4">
          {imagePreviewSrc ? (
            <div className="relative">
              <img
                src={imagePreviewSrc}
                className={twMerge(
                  'flex h-32 w-32 cursor-pointer items-center justify-center rounded-sm border border-gray-100 bg-gray-50 hover:opacity-80',
                  isLoading ? 'opacity-50' : '',
                  errorMessage ? 'border-red-800' : '',
                )}
                onClick={(e) => {
                  inputFileRef.current?.click()
                }}
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
              className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-sm border border-gray-100 bg-gray-50  hover:bg-gray-100 "
            >
              <PhotoIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}

          {errorMessage ? (
            <div className="text-red-800">{errorMessage}</div>
          ) : null}
        </div>
      </form>
    </>
  )
}
