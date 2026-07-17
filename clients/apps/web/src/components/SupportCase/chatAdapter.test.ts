import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { supportCaseUploader } from './chatAdapter'

const mockOrganization = {
  id: 'org-123',
  name: 'Test Org',
} as schemas['Organization']

describe('supportCaseUploader', () => {
  it('accepts files with supported MIME types', () => {
    const file = new File(['test'], 'image.jpg', { type: 'image/jpeg' })

    expect(supportCaseUploader(mockOrganization).isAccepted(file)).toBe(true)
  })

  it('rejects files when the browser does not provide a MIME type', () => {
    const file = new File(['test'], 'image.jpg', { type: '' })

    expect(supportCaseUploader(mockOrganization).isAccepted(file)).toBe(false)
  })

  it('only advertises supported MIME types in the file picker', () => {
    expect(supportCaseUploader(mockOrganization).accept).toBe(
      [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'text/csv',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].join(','),
    )
  })
})
