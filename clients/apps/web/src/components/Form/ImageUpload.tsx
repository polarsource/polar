'use client'

import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { createSHA256 } from 'hash-wasm'
import { ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const CHUNK_SIZE = 10_000_000 // 10MB

async function getSha256Base64(buffer: ArrayBuffer): Promise<string> {
  const sha256 = await crypto.subtle.digest('SHA-256', buffer)
  return btoa(String.fromCharCode(...new Uint8Array(sha256)))
}

async function uploadFileToS3(file: File): Promise<string> {
  // 1. Compute SHA-256 of the full file and each chunk
  const chunkCount = Math.floor(file.size / CHUNK_SIZE) + 1
  const parts: schemas['S3FileCreatePart'][] = []
  const hasher = await createSHA256()

  for (let i = 1; i <= chunkCount; i++) {
    const chunkStart = (i - 1) * CHUNK_SIZE
    const chunkEnd = Math.min(i * CHUNK_SIZE, file.size)
    const chunkBlob = file.slice(chunkStart, chunkEnd)
    const chunk = await chunkBlob.arrayBuffer()

    const chunkSha256base64 = await getSha256Base64(chunk)
    hasher.update(new Uint8Array(chunk))

    parts.push({
      number: i,
      chunk_start: chunkStart,
      chunk_end: chunkEnd,
      checksum_sha256_base64: chunkSha256base64,
    })
  }

  const hashBinary = hasher.digest('binary')
  const sha256base64 = btoa(String.fromCharCode(...hashBinary))

  const mimeType = file.type || 'application/octet-stream'

  // 2. Create file record via API
  const { data: createResponse, error: createError } = await api.POST(
    '/v1/files/',
    {
      body: {
        service: 'oauth_logo',
        name: file.name,
        size: file.size,
        mime_type: mimeType,
        checksum_sha256_base64: sha256base64,
        upload: { parts },
      } as schemas['FileCreate'],
    },
  )

  if (createError || !createResponse) {
    throw new Error('Failed to create file upload')
  }

  // 3. Upload chunks to presigned S3 URLs
  const uploadedParts: schemas['S3FileUploadCompletedPart'][] = []
  for (const part of createResponse.upload.parts) {
    const chunkBlob = file.slice(part.chunk_start, part.chunk_end)
    const blob = new Blob([chunkBlob], { type: mimeType })

    const etag = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const etag = xhr.getResponseHeader('ETag')
            if (!etag) {
              reject(new Error('ETag not found in response'))
              return
            }
            resolve(etag)
          } else {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`))
          }
        }
      }
      xhr.open('PUT', part.url, true)
      if (part.headers) {
        for (const [header, value] of Object.entries(part.headers)) {
          xhr.setRequestHeader(header, value)
        }
      }
      xhr.send(blob)
    })

    uploadedParts.push({
      number: part.number,
      checksum_etag: etag,
      checksum_sha256_base64: part.checksum_sha256_base64 || null,
    })
  }

  // 4. Complete the upload
  const { data: completeResponse, error: completeError } = await api.POST(
    '/v1/files/{id}/uploaded',
    {
      params: { path: { id: createResponse.id } },
      body: {
        id: createResponse.upload.id,
        path: createResponse.upload.path,
        parts: uploadedParts,
      },
    },
  )

  if (completeError || !completeResponse) {
    throw new Error('Failed to complete file upload')
  }

  return (completeResponse as { public_url: string }).public_url
}

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

  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | undefined>()

  useEffect(() => {
    setImagePreviewSrc(defaultValue)
  }, [defaultValue])

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
      const publicUrl = await uploadFileToS3(file)
      onUploaded(publicUrl)
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
                  'flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-gray-50 object-cover hover:opacity-80',
                  isLoading ? 'opacity-50' : '',
                  errorMessage ? 'border-red-500' : '',
                  !height && !width ? 'h-32 w-32' : '',
                )}
                onClick={() => {
                  inputFileRef.current?.click()
                }}
                onLoad={onLoad}
                height={height}
                width={width}
              />
              {isLoading ? (
                <div className="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center">
                  <SpinnerNoMargin />
                </div>
              ) : null}
            </div>
          ) : (
            <div
              onClick={() => {
                inputFileRef.current?.click()
              }}
              className={twMerge(
                'dark:bg-polar-700 dark:border-polar-600 flex cursor-pointer flex-col items-center justify-center gap-y-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100',
                !height && !width ? 'h-32 w-32' : '',
              )}
              style={{
                maxWidth: width,
                maxHeight: height,
                width: width && height ? '100%' : undefined,
                aspectRatio: `${width} / ${height}`,
              }}
            >
              <ImageIcon className="h-6 w-6 text-gray-600" />
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
