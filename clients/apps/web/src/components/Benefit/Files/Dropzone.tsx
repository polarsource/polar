'use client'

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

const getSha256Base64 = async (buffer: ArrayBuffer) => {
  const sha256 = await crypto.subtle.digest('SHA-256', buffer)
  const sha256base64 = btoa(String.fromCharCode(...new Uint8Array(sha256)))
  return sha256base64
}

const Dropzone = ({
  organization,
  onUploaded,
}: {
  organization: Organization
  onUploaded: (file: FileRead) => void
}) => {
  const CHUNK_SIZE = 10000000 // 10MB

  const getParts = async (
    file: File,
    buffer: ArrayBuffer,
  ): Promise<Array<FileCreatePart>> => {
    const chunkCount = Math.floor(file.size / CHUNK_SIZE) + 1
    const parts: Array<FileCreatePart> = []

    for (let i = 1; i <= chunkCount; i++) {
      const chunk_start = (i - 1) * CHUNK_SIZE
      const chunk_end = i * CHUNK_SIZE
      const chunk =
        i < chunkCount
          ? buffer.slice(chunk_start, chunk_end)
          : buffer.slice(chunk_start)

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

  const uploadParts = async (
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

  const createFile = async (
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

  const handleUpload = async (file: File, buffer: ArrayBuffer) => {
    const parts = await getParts(file, buffer)

    const createFileResponse = await createFile(file, buffer, parts)
    const upload = createFileResponse?.upload
    if (!upload) return

    const uploadedParts = await uploadParts(file, buffer, upload.parts)

    const completeUploadResponse = await api.files.completeUpload({
      fileId: createFileResponse.id,
      fileUploadCompleted: {
        upload: {
          id: upload.id,
          parts: uploadedParts,
        },
      },
    })

    onUploaded(completeUploadResponse)
  }

  return (
    <>
      <input
        name="file"
        type="file"
        required
        multiple={true}
        tabIndex={-1}
        onChange={async (e) => {
          const files = e.target.files
          if (!files) return

          for (const file of files) {
            const reader = new FileReader()
            reader.onload = async () => {
              const result = reader.result
              if (result instanceof ArrayBuffer) {
                await handleUpload(file, result)
              }
            }
            reader.readAsArrayBuffer(file)
          }
        }}
      />
    </>
  )
}

export default Dropzone
