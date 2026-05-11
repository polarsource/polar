import { Upload } from '@/components/FileUpload/Upload'
import { retryWithBackoff } from '@/utils/retry'
import { schemas } from '@polar-sh/client'
import * as Sentry from '@sentry/nextjs'

const uploadProductMedia = (
  file: File,
  organization: schemas['Organization'],
): Promise<schemas['ProductMediaFileRead']> =>
  new Promise((resolve, reject) => {
    const upload = new Upload({
      organization,
      service: 'product_media',
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: () => {},
      onFileUploaded: (uploaded) =>
        resolve(uploaded as schemas['ProductMediaFileRead']),
      onFileUploadError: (_fileId, error) => reject(error),
    })
    upload.run().catch(reject)
  })

export const duplicateProductMedia = async (
  media: schemas['ProductMediaFileRead'],
  organization: schemas['Organization'],
): Promise<schemas['ProductMediaFileRead']> => {
  try {
    const response = await retryWithBackoff(() => fetch(media.public_url), {
      initialDelayMs: 500,
      maxDelayMs: 3000,
    })
    const blob = await response.blob()
    const file = new File([blob], media.name, { type: media.mime_type })
    return await uploadProductMedia(file, organization)
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'product-duplicate-media-copy' },
      extra: {
        mediaId: media.id,
        mediaName: media.name,
        mimeType: media.mime_type,
        size: media.size,
      },
    })
    throw error
  }
}
