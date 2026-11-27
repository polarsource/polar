import { renderWithProviders } from '@/test-utils/render'
import { API_URL, apiError, server } from '@/test-utils/server'
import { schemas } from '@polar-sh/client'
import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useEffect } from 'react'
import { FormProvider, UseFormReturn, useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { DownloadablesBenefitForm } from './BenefitForm'

const organization = {
  id: 'org-1',
  slug: 'acme',
  name: 'Acme',
} as schemas['Organization']

const existingFile: schemas['DownloadableFileRead'] = {
  id: 'file-1',
  organization_id: 'org-1',
  name: 'guide.pdf',
  path: 'downloadable/org-1/guide.pdf',
  mime_type: 'application/pdf',
  size: 1024,
  size_readable: '1 KB',
  storage_version: null,
  checksum_etag: null,
  checksum_sha256_base64: null,
  checksum_sha256_hex: null,
  last_modified_at: null,
  version: null,
  service: 'downloadable',
  is_uploaded: true,
  created_at: '2026-01-01T00:00:00Z',
  flagged_malicious_at: null,
}

type FormValues = schemas['BenefitDownloadablesCreate']

const renderEditForm = (
  fileIds: string[],
  onSubmit: (values: FormValues) => void = vi.fn(),
) => {
  let formMethods: UseFormReturn<FormValues> | undefined

  const Harness = () => {
    const form = useForm<FormValues>({
      defaultValues: {
        type: 'downloadables',
        description: 'Downloads',
        organization_id: organization.id,
        properties: {
          files: fileIds,
          archived: {},
        },
      },
    })
    useEffect(() => {
      formMethods = form
    }, [form])
    return (
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DownloadablesBenefitForm organization={organization} update={true} />
          <button type="submit">Update</button>
        </form>
      </FormProvider>
    )
  }

  const result = renderWithProviders(<Harness />)
  return { ...result, getForm: () => formMethods! }
}

describe('DownloadablesBenefitForm (edit)', () => {
  it('shows an error state instead of the upload form when the files query fails, preserves file ids, and recovers on retry', async () => {
    let failRequest = true
    server.use(
      http.get(`${API_URL}/v1/files/`, () => {
        if (failRequest) {
          return apiError(404, 'NotFound')
        }
        return HttpResponse.json({
          items: [existingFile],
          pagination: { total_count: 1, max_page: 1 },
        })
      }),
    )

    const onSubmit = vi.fn()
    const { getForm } = renderEditForm([existingFile.id], onSubmit)

    expect(await screen.findByText('Could not load files')).toBeVisible()
    expect(screen.queryByText('Feed me some bytes')).not.toBeInTheDocument()
    expect(getForm().getValues('properties.files')).toEqual([existingFile.id])

    failRequest = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('guide.pdf')).toBeVisible()
    expect(screen.getByText('Feed me some bytes')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(getForm().getValues('properties.files')).toEqual([existingFile.id])
  })

  it('preserves original file ids if the form is submitted while the files query has failed', async () => {
    server.use(
      http.get(`${API_URL}/v1/files/`, () => apiError(404, 'NotFound')),
    )

    const onSubmit = vi.fn()
    renderEditForm([existingFile.id], onSubmit)

    expect(await screen.findByText('Could not load files')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit.mock.calls[0][0].properties.files).toEqual([
      existingFile.id,
    ])
  })

  it('shows a loading state without mounting the upload form while files are pending', () => {
    server.use(http.get(`${API_URL}/v1/files/`, () => new Promise(() => {})))

    renderEditForm([existingFile.id])

    expect(screen.getByText('Loading...')).toBeVisible()
    expect(screen.queryByText('Feed me some bytes')).not.toBeInTheDocument()
  })

  it('mounts the upload form immediately when editing a benefit with no existing files', () => {
    renderEditForm([])

    expect(screen.getByText('Feed me some bytes')).toBeVisible()
  })
})
