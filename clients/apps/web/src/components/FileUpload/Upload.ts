import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { createSHA256 } from 'hash-wasm'

const CHUNK_SIZE = 10000000 // 10MB

export type FileRead =
  | schemas['DownloadableFileRead']
  | schemas['ProductMediaFileRead']
  | schemas['OrganizationAvatarFileRead']

interface UploadProperties {
  organization: schemas['Organization']
  service: schemas['FileServiceTypes']
  file: File
  onFileProcessing: (tempId: string, file: File) => void
  onFileCreate: (tempId: string, response: schemas['FileUpload']) => void
  onFileUploadProgress: (file: schemas['FileUpload'], uploaded: number) => void
  onFileUploaded: (response: FileRead) => void
}

export class Upload {
  organization: schemas['Organization']
  service: schemas['FileServiceTypes']
  file: File
  tempId: string
  onFileProcessing: (tempId: string, file: File) => void
  onFileCreate: (tempId: string, response: schemas['FileUpload']) => void
  onFileUploadProgress: (file: schemas['FileUpload'], uploaded: number) => void
  onFileUploaded: (response: FileRead) => void

  constructor({
    organization,
    service,
    file,
    onFileProcessing,
    onFileCreate,
    onFileUploadProgress,
    onFileUploaded,
  }: UploadProperties) {
    this.organization = organization
    this.service = service
    this.file = file
    this.tempId = `temp-${Date.now()}-${Math.random()}`
    this.onFileProcessing = onFileProcessing
    this.onFileCreate = onFileCreate
    this.onFileUploadProgress = onFileUploadProgress
    this.onFileUploaded = onFileUploaded
  }

  async getSha256Base64(buffer: ArrayBuffer) {
    const sha256 = await crypto.subtle.digest('SHA-256', buffer)
    const sha256base64 = btoa(String.fromCharCode(...new Uint8Array(sha256)))
    return sha256base64
  }

  async create() {
    const { sha256base64, parts } = await this.getMultiparts()
    const mimeType = this.file.type
      ? this.file.type
      : 'application/octet-stream'

    const params: schemas['FileCreate'] = {
      organization_id: this.organization.id,
      service: this.service,
      name: this.file.name,
      size: this.file.size,
      mime_type: mimeType,
      checksum_sha256_base64: sha256base64,
      upload: { parts: parts },
    }

    return await api.POST('/v1/files/', { body: params })
  }

  async getMultiparts(): Promise<{
    sha256base64: string
    parts: Array<schemas['S3FileCreatePart']>
  }> {
    const chunkCount = Math.floor(this.file.size / CHUNK_SIZE) + 1
    const parts: Array<schemas['S3FileCreatePart']> = []
    const hasher = await createSHA256()

    for (let i = 1; i <= chunkCount; i++) {
      const chunk_start = (i - 1) * CHUNK_SIZE
      let chunk_end = i * CHUNK_SIZE
      if (chunk_end > this.file.size) {
        chunk_end = this.file.size
      }
      const chunkBlob = this.file.slice(chunk_start, chunk_end)
      const chunk = await chunkBlob.arrayBuffer()

      const chunkSha256base64 = await this.getSha256Base64(chunk)
      hasher.update(new Uint8Array(chunk))

      const part: schemas['S3FileCreatePart'] = {
        number: i,
        chunk_start: chunk_start,
        chunk_end: chunk_end,
        checksum_sha256_base64: chunkSha256base64,
      }
      parts.push(part)
    }

    const hashBinary = hasher.digest('binary')
    const sha256base64 = btoa(String.fromCharCode(...hashBinary))
    return { sha256base64, parts }
  }

  async uploadMultiparts({
    parts,
    onProgress,
  }: {
    parts: Array<schemas['S3FileUploadPart']>
    onProgress: (uploaded: number) => void
  }): Promise<schemas['S3FileUploadCompletedPart'][]> {
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
    part: schemas['S3FileUploadPart']
    onProgress: (uploaded: number) => void
  }): Promise<schemas['S3FileUploadCompletedPart']> {
    const chunkBlob = this.file.slice(part.chunk_start, part.chunk_end)
    const blob = new Blob([chunkBlob], { type: this.file.type })

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
            const completed: schemas['S3FileUploadCompletedPart'] = {
              number: part.number,
              checksum_etag: etag,
              checksum_sha256_base64: part.checksum_sha256_base64 || null,
            }
            resolve(completed)
          } else {
            reject(
              new Error(
                `Failed to upload part: HTTP ${xhr.status} - ${xhr.statusText}`,
              ),
            )
          }
        }
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded)
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
  }

  async complete(
    createFileResponse: schemas['FileUpload'],
    uploadedParts: schemas['S3FileUploadCompletedPart'][],
  ) {
    const { data, error } = await api.POST('/v1/files/{id}/uploaded', {
      params: { path: { id: createFileResponse.id } },
      body: {
        id: createFileResponse.upload.id,
        path: createFileResponse.upload.path,
        parts: uploadedParts,
      },
    })

    if (error) {
      return
    }

    this.onFileUploaded(data)
  }

  async run() {
    this.onFileProcessing(this.tempId, this.file)

    const { data: createFileResponse, error } = await this.create()
    if (error) {
      return
    }
    const upload = createFileResponse.upload

    this.onFileCreate(this.tempId, createFileResponse)

    const uploadedParts = await this.uploadMultiparts({
      parts: upload.parts,
      onProgress: (uploaded: number) => {
        this.onFileUploadProgress(createFileResponse, uploaded)
      },
    })

    await this.complete(createFileResponse, uploadedParts)
  }
}
