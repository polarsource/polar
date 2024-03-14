import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import {
  CloseOutlined,
  EditOutlined,
  PanoramaOutlined,
} from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { PutBlobResult } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import Button from 'polarkit/components/ui/atoms/button'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CoverEditorProps {
  organization: Organization
  coverImageUrl?: string
  onChange: (coverImageUrl: string | undefined) => void
  disabled?: boolean
}

export const CoverEditor = ({
  organization,
  coverImageUrl,
  onChange,
  disabled,
}: CoverEditorProps) => {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [blob, setBlob] = useState<PutBlobResult | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | undefined>(
    coverImageUrl,
  )

  const [isLoading, setIsLoading] = useState(false)

  const handleUpload = async () => {
    if (!inputFileRef.current?.files) {
      throw new Error('No file selected')
    }

    const file = inputFileRef.current.files[0]

    setIsLoading(true)

    try {
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      })
      setBlob(newBlob)
      onChange(newBlob.url)
    } finally {
      setIsLoading(false)
    }
  }

  if (!imagePreviewSrc && disabled) {
    return null
  }

  return (
    <form>
      <input
        style={{ display: 'none', height: 0 }}
        name="file"
        ref={inputFileRef}
        type="file"
        required
        accept="image/png, image/jpeg, image/gif"
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
            setImagePreviewSrc(coverImageUrl)
          }
        }}
      />
      <div
        className={twMerge(
          'dark:bg-polar-900 relative flex aspect-video w-full flex-col items-center justify-center gap-y-4 overflow-hidden rounded-3xl bg-blue-50',
          !imagePreviewSrc && 'cursor-pointer',
        )}
        onClick={() => {
          if (!imagePreviewSrc && !isLoading) {
            inputFileRef.current?.click()
          }
        }}
      >
        {imagePreviewSrc && (
          <Image
            className="aspect-video h-full w-full object-cover"
            alt={`${organization.name}'s banner image`}
            src={imagePreviewSrc}
            width={960}
            height={320}
            priority
          />
        )}
        {!imagePreviewSrc && (
          <>
            <PanoramaOutlined
              fontSize="large"
              className="text-blue-500 dark:text-blue-400"
            />
            <h3 className="text-center text-lg">Project Cover Image</h3>
            <p className="text-center text-blue-500 dark:text-blue-400">
              Enhance your project page with a cover image
            </p>
          </>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white dark:text-white">
            <SpinnerNoMargin className="z-20 h-12 w-12" />
          </div>
        )}
        {!disabled && imagePreviewSrc && !isLoading && (
          <div className="absolute bottom-4 right-4 hidden flex-row gap-x-2 md:flex">
            <Button
              className="text-white dark:text-white"
              variant="ghost"
              size="icon"
              onClick={() => {
                inputFileRef.current?.click()
              }}
            >
              <EditOutlined fontSize="small" />
            </Button>
            <Button
              className="text-white dark:text-white"
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange(undefined)
                setImagePreviewSrc(undefined)
              }}
            >
              <CloseOutlined fontSize="small" />
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
