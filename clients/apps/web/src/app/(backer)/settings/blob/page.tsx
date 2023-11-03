'use client'

import { PhotoIcon } from '@heroicons/react/24/outline'
import { type PutBlobResult } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import { Button } from 'polarkit/components/ui/atoms'
import { useRef, useState } from 'react'

export default function AvatarUploadPage() {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [blob, setBlob] = useState<PutBlobResult | null>(null)

  // const imagePreview = useRef<HTMLImageElement>(null)

  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | undefined>()

  return (
    <>
      <h1>Wow blob uploads!</h1>

      <form
        onSubmit={async (event) => {
          event.preventDefault()

          if (!inputFileRef.current?.files) {
            throw new Error('No file selected')
          }

          const file = inputFileRef.current.files[0]

          const newBlob = await upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/blob/upload',
          })

          setBlob(newBlob)
        }}
      >
        <input
          style={{ visibility: 'hidden' }}
          name="file"
          ref={inputFileRef}
          type="file"
          required
          onChange={(e) => {
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
            } else {
              setImagePreviewSrc(undefined)
            }
          }}
        />

        <div className="flex gap-4">
          {imagePreviewSrc ? (
            <img
              src={imagePreviewSrc}
              className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-sm border border-gray-100 bg-gray-50 hover:opacity-80"
              onClick={(e) => {
                inputFileRef.current?.click()
              }}
            />
          ) : (
            <div
              onClick={(e) => {
                inputFileRef.current?.click()
              }}
              className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-sm border border-gray-100 bg-gray-50 hover:opacity-80"
            >
              <PhotoIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}

          <Button type="submit">Upload</Button>
        </div>
      </form>

      {blob && (
        <div>
          Blob url: <a href={blob.url}>{blob.url}</a>
        </div>
      )}
    </>
  )
}
