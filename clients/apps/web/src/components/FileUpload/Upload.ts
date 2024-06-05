'use client'

import { api } from '@/utils/api'
import {
  FileCreate,
  FileRead,
  FileServiceTypes,
  FileUpload,
  Organization,
  S3FileCreatePart,
  S3FileUploadCompletedPart,
  S3FileUploadPart,
} from '@polar-sh/sdk'

const CHUNK_SIZE = 10000000 // 10MB

interface UploadProperties {
  organization: Organization
  service: FileServiceTypes
  file: File
  buffer: ArrayBuffer
  onFileCreate: (response: FileUpload) => void
  onFileUploadProgress: (file: FileUpload, uploaded: number) => void
  onFileUploaded: (response: FileRead) => void
}

export class Upload {
  organization: Organization
  service: FileServiceTypes
  file: File
  buffer: ArrayBuffer
  onFileCreate: (response: FileUpload) => void
  onFileUploadProgress: (file: FileUpload, uploaded: number) => void
  onFileUploaded: (response: FileRead) => void

  constructor({
    organization,
    service,
    file,
    buffer,
    onFileCreate,
    onFileUploadProgress,
    onFileUploaded,
  }: UploadProperties) {
    this.organization = organization
    this.service = service
    this.file = file
    this.buffer = buffer
    this.onFileCreate = onFileCreate
    this.onFileUploadProgress = onFileUploadProgress
    this.onFileUploaded = onFileUploaded
  }

  async getSha256Base64(buffer: ArrayBuffer) {
    const sha256 = await crypto.subtle.digest('SHA-256', buffer)
    const sha256base64 = btoa(String.fromCharCode(...new Uint8Array(sha256)))
    return sha256base64
  }

  async create(): Promise<FileUpload> {
    const sha256base64 = await this.getSha256Base64(this.buffer)
    const parts = await this.getMultiparts()
    const params: FileCreate = {
      organization_id: this.organization.id,
      service: this.service,
      name: this.file.name,
      size: this.file.size,
      mime_type: this.file.type,
      checksum_sha256_base64: sha256base64,
      upload: { parts: parts },
    }

    return api.files.create({
      fileCreate: params,
    })
  }

  async getMultiparts(): Promise<Array<S3FileCreatePart>> {
    const chunkCount = Math.floor(this.file.size / CHUNK_SIZE) + 1
    const parts: Array<S3FileCreatePart> = []

    for (let i = 1; i <= chunkCount; i++) {
      const chunk_start = (i - 1) * CHUNK_SIZE
      let chunk_end = i * CHUNK_SIZE
      if (chunk_end > this.file.size) {
        chunk_end = this.file.size
      }
      const chunk = this.buffer.slice(chunk_start, chunk_end)

      const chunkSha256base64 = await this.getSha256Base64(chunk)

      let part: S3FileCreatePart = {
        number: i,
        chunk_start: chunk_start,
        chunk_end: chunk_end,
        checksum_sha256_base64: chunkSha256base64,
      }
      parts.push(part)
    }
    return parts
  }

  async uploadMultiparts({
    parts,
    onProgress,
  }: {
    parts: Array<S3FileUploadPart>
    onProgress: (uploaded: number) => void
  }): Promise<S3FileUploadCompletedPart[]> {
    const ret = []
    let uploaded = 0
    const partCount = parts.length
    /**
     * Unfortunately, we need to do this sequentially vs. in paralell since we
     * do SHA-256 validations and AWS S3 would 400 if they receive requests in
     * non-consecutive order according to their docs.
     */
    for (let i = 0; i < partCount; i++) {
      const part = parts[i]
      const completed = await this.upload({
        part,
        onProgress: (chunk_uploaded) => {
          onProgress(uploaded + chunk_uploaded)
        },
      })
      uploaded += part.chunk_end - part.chunk_start
      onProgress(uploaded)
      ret.push(completed)
    }

    return ret
  }

  async upload({
    part,
    onProgress,
  }: {
    part: S3FileUploadPart
    onProgress: (uploaded: number) => void
  }): Promise<S3FileUploadCompletedPart> {
    const data = this.buffer.slice(part.chunk_start, part.chunk_end)
    let blob = new Blob([data], { type: this.file.type })

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const etag = xhr.getResponseHeader('ETag')
            if (!etag) {
              reject(new Error('ETag not found in response'))
              return
            }
            const completed: S3FileUploadCompletedPart = {
              number: part.number,
              checksum_etag: etag,
            }
            if (part.checksum_sha256_base64) {
              completed.checksum_sha256_base64 = part.checksum_sha256_base64
            }
            resolve(completed)
          } else {
            reject(new Error('Failed to upload part'))
          }
        }
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded)
        }
      }

      xhr.open('PUT', part.url, true)
      xhr.setRequestHeader('Origin', window.location.origin)
      if (part.headers) {
        for (const [header, value] of Object.entries(part.headers)) {
          xhr.setRequestHeader(header, value)
        }
      }

      xhr.send(blob)
    })
  }

  async complete(
    createFileResponse: FileUpload,
    uploadedParts: S3FileUploadCompletedPart[],
  ) {
    return api.files
      .uploaded({
        id: createFileResponse.id,
        fileUploadCompleted: {
          id: createFileResponse.upload.id,
          path: createFileResponse.upload.path,
          parts: uploadedParts,
        },
      })
      .then(this.onFileUploaded)
  }

  async run() {
    const createFileResponse = await this.create()
    const upload = createFileResponse?.upload
    if (!upload) return

    this.onFileCreate(createFileResponse)

    const uploadedParts = await this.uploadMultiparts({
      parts: upload.parts,
      onProgress: (uploaded: number) => {
        this.onFileUploadProgress(createFileResponse, uploaded)
      },
    })

    await this.complete(createFileResponse, uploadedParts)
  }
}
