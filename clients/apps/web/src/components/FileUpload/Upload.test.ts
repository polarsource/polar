import { schemas } from '@polar-sh/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Upload } from './Upload'

vi.mock('@/utils/client', () => ({
  api: {
    POST: vi.fn(),
  },
}))

vi.mock('hash-wasm', () => ({
  createSHA256: vi.fn(),
}))

const { api } = await import('@/utils/client')

const mockOrganization = {
  id: 'org-123',
  name: 'Test Org',
} as schemas['Organization']

const mockFileUpload: schemas['FileUpload'] = {
  id: 'file-123',
  organization_id: 'org-123',
  name: 'test.zip',
  path: 'downloadable/org-123/file-123/test.zip',
  mime_type: 'application/zip',
  size: 100,
  size_readable: '100 B',
  is_uploaded: false,
  service: 'downloadable',
  storage_version: null,
  checksum_etag: null,
  checksum_sha256_base64: null,
  checksum_sha256_hex: null,
  last_modified_at: null,
  version: null,
  upload: {
    id: 'upload-123',
    path: 'downloadable/org-123/file-123/test.zip',
    parts: [
      {
        number: 1,
        chunk_start: 0,
        chunk_end: 100,
        checksum_sha256_base64: 'abc123',
        url: 'https://s3.example.com/upload?part=1',
        expires_at: '2024-01-01T00:10:00Z',
        headers: { 'x-amz-checksum-sha256': 'abc123' },
      },
    ],
  },
}

const mockFileRead = {
  ...mockFileUpload,
  is_uploaded: true,
  checksum_sha256_base64: 'abc123',
  checksum_sha256_hex: 'abc123hex',
  last_modified_at: '2024-01-01T00:00:00Z',
  storage_version: 'v1',
  version: null,
}

function createTestFile(size = 100) {
  return new File([new ArrayBuffer(size)], 'test.zip', {
    type: 'application/zip',
  })
}

function createUpload(
  overrides: Partial<ConstructorParameters<typeof Upload>[0]> = {},
) {
  return new Upload({
    organization: mockOrganization,
    service: 'downloadable',
    file: createTestFile(),
    onFileProcessing: vi.fn(),
    onFileCreate: vi.fn(),
    onFileUploadProgress: vi.fn(),
    onFileUploaded: vi.fn(),
    onFileUploadError: vi.fn(),
    ...overrides,
  })
}

interface MockXHRInstance {
  open: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  getResponseHeader: ReturnType<typeof vi.fn>
  readyState: number
  status: number
  statusText: string
  onreadystatechange: ((this: XMLHttpRequest, ev: Event) => void) | null
  upload: {
    onprogress: ((this: XMLHttpRequestUpload, ev: ProgressEvent) => void) | null
  }
}

function mockXHR(options: { status?: number; etag?: string | null } = {}) {
  const { status = 200, etag = '"abc123"' } = options

  class MockXHR {
    open = vi.fn()
    send = vi.fn().mockImplementation(function (this: MockXHRInstance) {
      if (this.upload?.onprogress) {
        this.upload.onprogress.call(
          {} as XMLHttpRequestUpload,
          { lengthComputable: true, loaded: 50 } as ProgressEvent,
        )
      }
      this.readyState = 4
      this.status = status
      this.statusText = status === 200 ? 'OK' : 'Error'
      this.onreadystatechange?.call({} as XMLHttpRequest, {} as Event)
    })
    setRequestHeader = vi.fn()
    getResponseHeader = vi.fn().mockImplementation((header: string) => {
      if (header === 'ETag') return etag
      return null
    })
    readyState = 0
    status = 0
    statusText = ''
    onreadystatechange: ((this: XMLHttpRequest, ev: Event) => void) | null =
      null
    upload: {
      onprogress:
        | ((this: XMLHttpRequestUpload, ev: ProgressEvent) => void)
        | null
    } = { onprogress: null }
  }

  vi.stubGlobal('XMLHttpRequest', MockXHR)
}

type CreateResult = Awaited<ReturnType<Upload['create']>>
type PostResult = Awaited<ReturnType<typeof api.POST>>

describe('Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('run - error handling', () => {
    it('should complete a successful upload end-to-end', async () => {
      const onFileProcessing = vi.fn()
      const onFileCreate = vi.fn()
      const onFileUploaded = vi.fn()
      const onFileUploadError = vi.fn()

      const upload = createUpload({
        onFileProcessing,
        onFileCreate,
        onFileUploaded,
        onFileUploadError,
      })

      vi.spyOn(upload, 'create').mockResolvedValue({
        data: mockFileUpload,
        error: undefined,
        response: new Response(),
      } as unknown as CreateResult)

      mockXHR()

      vi.mocked(api.POST).mockResolvedValueOnce({
        data: mockFileRead,
        error: undefined,
        response: new Response(),
      } as unknown as PostResult)

      await upload.run()

      expect(onFileProcessing).toHaveBeenCalledOnce()
      expect(onFileCreate).toHaveBeenCalledOnce()
      expect(onFileUploaded).toHaveBeenCalledWith(mockFileRead)
      expect(onFileUploadError).not.toHaveBeenCalled()
    })

    it('should call onFileUploadError with tempId when file creation fails', async () => {
      const onFileProcessing = vi.fn()
      const onFileCreate = vi.fn()
      const onFileUploaded = vi.fn()
      const onFileUploadError = vi.fn()

      const upload = createUpload({
        onFileProcessing,
        onFileCreate,
        onFileUploaded,
        onFileUploadError,
      })

      vi.spyOn(upload, 'create').mockResolvedValue({
        data: undefined,
        error: { detail: 'Bad request' },
        response: new Response(null, { status: 422 }),
      } as unknown as CreateResult)

      await upload.run()

      expect(onFileProcessing).toHaveBeenCalledOnce()
      expect(onFileCreate).not.toHaveBeenCalled()
      expect(onFileUploaded).not.toHaveBeenCalled()
      expect(onFileUploadError).toHaveBeenCalledOnce()
      expect(onFileUploadError).toHaveBeenCalledWith(
        upload.tempId,
        expect.any(Error),
      )
    })

    it('should call onFileUploadError with file id when S3 returns 403', async () => {
      const onFileCreate = vi.fn()
      const onFileUploaded = vi.fn()
      const onFileUploadError = vi.fn()

      const upload = createUpload({
        onFileCreate,
        onFileUploaded,
        onFileUploadError,
      })

      vi.spyOn(upload, 'create').mockResolvedValue({
        data: mockFileUpload,
        error: undefined,
        response: new Response(),
      } as unknown as CreateResult)

      mockXHR({ status: 403 })

      await upload.run()

      expect(onFileCreate).toHaveBeenCalledOnce()
      expect(onFileUploaded).not.toHaveBeenCalled()
      expect(onFileUploadError).toHaveBeenCalledOnce()
      expect(onFileUploadError).toHaveBeenCalledWith(
        'file-123',
        expect.objectContaining({
          message: expect.stringContaining('Failed to upload part'),
        }),
      )
    })

    it('should call onFileUploadError when XHR returns status 0 (network error)', async () => {
      const onFileUploaded = vi.fn()
      const onFileUploadError = vi.fn()

      const upload = createUpload({ onFileUploaded, onFileUploadError })

      vi.spyOn(upload, 'create').mockResolvedValue({
        data: mockFileUpload,
        error: undefined,
        response: new Response(),
      } as unknown as CreateResult)

      mockXHR({ status: 0 })

      await upload.run()

      expect(onFileUploaded).not.toHaveBeenCalled()
      expect(onFileUploadError).toHaveBeenCalledOnce()
      expect(onFileUploadError).toHaveBeenCalledWith(
        'file-123',
        expect.objectContaining({
          message: expect.stringContaining('Failed to upload part'),
        }),
      )
    })

    it('should call onFileUploadError when complete endpoint returns error', async () => {
      const onFileUploaded = vi.fn()
      const onFileUploadError = vi.fn()

      const upload = createUpload({ onFileUploaded, onFileUploadError })

      vi.spyOn(upload, 'create').mockResolvedValue({
        data: mockFileUpload,
        error: undefined,
        response: new Response(),
      } as unknown as CreateResult)

      mockXHR()

      vi.mocked(api.POST).mockResolvedValueOnce({
        data: undefined,
        error: { detail: 'NoSuchUpload' },
        response: new Response(null, { status: 500 }),
      } as unknown as PostResult)

      await upload.run()

      expect(onFileUploaded).not.toHaveBeenCalled()
      expect(onFileUploadError).toHaveBeenCalledOnce()
      expect(onFileUploadError).toHaveBeenCalledWith(
        'file-123',
        expect.objectContaining({
          message: expect.stringContaining('Failed to complete file upload'),
        }),
      )
    })
  })

  describe('upload (single part XHR)', () => {
    it('should resolve with completed part on success', async () => {
      mockXHR({ status: 200, etag: '"etag-value"' })

      const upload = createUpload()
      const part = mockFileUpload.upload.parts[0]

      const result = await upload.upload({ part, onProgress: vi.fn() })

      expect(result).toEqual({
        number: 1,
        checksum_etag: '"etag-value"',
        checksum_sha256_base64: 'abc123',
      })
    })

    it('should reject when S3 returns non-200 status', async () => {
      mockXHR({ status: 403 })

      const upload = createUpload()
      const part = mockFileUpload.upload.parts[0]

      await expect(
        upload.upload({ part, onProgress: vi.fn() }),
      ).rejects.toThrow('Failed to upload part: HTTP 403')
    })

    it('should reject when ETag is missing from response', async () => {
      mockXHR({ status: 200, etag: null })

      const upload = createUpload()
      const part = mockFileUpload.upload.parts[0]

      await expect(
        upload.upload({ part, onProgress: vi.fn() }),
      ).rejects.toThrow('ETag not found in response')
    })
  })
})
