import { api } from '@/utils/api'
import {
  FileCreate,
  FileCreatePart,
  FileRead,
  FileUpload,
  FileUploadCompletedPart,
  FileUploadPart,
  Organization,
} from '@polar-sh/sdk'

interface UploadProperties {
  organization: Organization
  file: File
  buffer: ArrayBuffer
  onSuccess: (response: FileRead) => void
}

export const upload = async ({
  organization,
  file,
  buffer,
  onSuccess,
}: UploadProperties) => {
  const parts = await getFileMultiparts(file, buffer)

  const createFileResponse = await createFile(organization, file, buffer, parts)
  const upload = createFileResponse?.upload
  if (!upload) return

  const uploadedParts = await uploadFileMultiparts(file, buffer, upload.parts)

  await completeUpload(createFileResponse, uploadedParts, onSuccess)
}

const CHUNK_SIZE = 10000000 // 10MB

const getSha256Base64 = async (buffer: ArrayBuffer) => {
  const sha256 = await crypto.subtle.digest('SHA-256', buffer)
  const sha256base64 = btoa(String.fromCharCode(...new Uint8Array(sha256)))
  return sha256base64
}

const createFile = async (
  organization: Organization,
  file: File,
  buffer: ArrayBuffer,
  parts: Array<FileCreatePart>,
): Promise<FileUpload> => {
  const sha256base64 = await getSha256Base64(buffer)
  const params: FileCreate = {
    organization_id: organization.id,
    name: file.name,
    size: file.size,
    mime_type: file.type,
    checksum: {
      sha256_base64: sha256base64,
    },
    upload: { parts: parts },
  }

  return api.files.createFile({
    fileCreate: params,
  })
}

const getFileMultiparts = async (
  file: File,
  buffer: ArrayBuffer,
): Promise<Array<FileCreatePart>> => {
  const chunkCount = Math.floor(file.size / CHUNK_SIZE) + 1
  const parts: Array<FileCreatePart> = []

  for (let i = 1; i <= chunkCount; i++) {
    const chunk_start = (i - 1) * CHUNK_SIZE
    let chunk_end = i * CHUNK_SIZE
    if (chunk_end > file.size) {
      chunk_end = file.size
    }
    const chunk = buffer.slice(chunk_start, chunk_end)

    const chunkSha256base64 = await getSha256Base64(chunk)

    let part: FileCreatePart = {
      number: i,
      chunk_start: chunk_start,
      chunk_end: chunk_end,
      checksum: {
        sha256_base64: chunkSha256base64,
      },
    }
    parts.push(part)
  }
  return parts
}

const uploadFileMultiparts = async (
  file: File,
  buffer: ArrayBuffer,
  parts: Array<FileUploadPart>,
): Promise<FileUploadCompletedPart[]> => {
  const ret = []
  const partCount = parts.length
  /**
   * Unfortunately, we need to do this sequentially vs. in paralell since we
   * do SHA-256 validations and AWS S3 would 400 if they receive requests in
   * non-consecutive order according to their docs.
   */
  for (let i = 0; i < partCount; i++) {
    const part = parts[i]
    const data = buffer.slice(part.chunk_start, part.chunk_end)
    let blob = new Blob([data], { type: file.type })

    const response = await fetch(part.url, {
      method: 'PUT',
      headers: part.headers,
      body: blob,
    })
    const etag = response.headers.get('ETag')
    if (!etag) {
      throw new Error('ETag not found in response')
    }

    const completed: FileUploadCompletedPart = {
      number: part.number,
      checksum: {
        etag: etag,
      },
    }
    if (part.checksum?.sha256_base64) {
      completed.checksum.sha256_base64 = part.checksum.sha256_base64
    }
    ret.push(completed)
  }
  return ret
}

const completeUpload = async (
  createFileResponse: FileUpload,
  uploadedParts: FileUploadCompletedPart[],
  callback: (response: FileRead) => void,
) => {
  return api.files
    .completeUpload({
      fileId: createFileResponse.id,
      fileUploadCompleted: {
        upload: {
          id: createFileResponse.upload.id,
          parts: uploadedParts,
        },
      },
    })
    .then(callback)
}
