'use client'

import { DisputeContextView } from '@/components/Disputes/DisputeContextView'
import { FileObject, useFileUpload } from '@/components/FileUpload'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { useCounterDispute } from '@/hooks/queries/disputes'
import { useOrder } from '@/hooks/queries/orders'
import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Textarea } from '@polar-sh/orbit/ui/textarea'
import { X } from 'lucide-react'
import Link from 'next/link'
import { notFound, useRouter } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const MIN_EXPLANATION_LENGTH = 20
const MAX_FILE_SIZE = 25 * 1024 * 1024

const EVIDENCE_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  organization: schemas['Organization']
  dispute: schemas['Dispute']
}

export const DisputeRespondView = ({ organization, dispute }: Props) => {
  const router = useRouter()
  const disputePath = `/dashboard/${organization.slug}/sales/disputes/${dispute.id}`

  const { data: order } = useOrder(dispute.order_id)
  const counterDispute = useCounterDispute()

  const [explanation, setExplanation] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<
    FileObject<schemas['SupportCaseAttachmentFileRead']>[]
  >([])

  const { getRootProps, getInputProps, isDragActive, removeFile } =
    useFileUpload<schemas['SupportCaseAttachmentFileRead']>({
      organization,
      service: 'support_case_attachment',
      accept: EVIDENCE_ACCEPT,
      maxSize: MAX_FILE_SIZE,
      initialFiles: [],
      onFilesUpdated: setEvidenceFiles,
      onFilesRejected: () =>
        toast({
          title: 'File not accepted',
          description: 'Use a PDF, image, or document under 25 MB.',
        }),
      onFileUploadError: (fileName) =>
        toast({
          title: 'Upload failed',
          description: `Could not upload ${fileName}. Please try again.`,
        }),
    })

  const isUploading = evidenceFiles.some(
    (file) => file.isUploading || file.isProcessing,
  )
  const isValid = explanation.trim().length >= MIN_EXPLANATION_LENGTH

  if (order && order.customer.organization_id !== organization.id) {
    notFound()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid || isUploading) {
      return
    }
    try {
      await counterDispute.mutateAsync({
        id: dispute.id,
        body: {
          explanation: explanation.trim(),
          product_description: productDescription.trim() || null,
          evidence_file_ids: evidenceFiles
            .filter((file) => file.is_uploaded)
            .map((file) => file.id),
        },
      })
      toast({
        title: 'Response submitted',
        description:
          'Our team will review your evidence and submit it to the card network.',
      })
      router.push(disputePath)
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Could not submit your response. Please try again.',
      })
    }
  }

  return (
    <DashboardBody
      title={
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h2">
            Counter dispute
          </Text>
          <Text color="muted">
            {getDisputeReasonExplanation(dispute.reason)}
          </Text>
        </Box>
      }
      contextViewTitle="Details"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
      contextView={
        order ? (
          <DisputeContextView organization={organization} order={order} />
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit}>
        <Box flexDirection="column" rowGap="xl">
          <Box flexDirection="column" rowGap="xs">
            <Text variant="label">Why is this payment legitimate?</Text>
            <Text variant="caption" color="muted">
              Explain why the customer&apos;s claim is incorrect and include any
              context that supports your case.
            </Text>
            <Textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Describe the evidence that proves this payment is valid…"
              className="min-h-32"
              maxLength={5000}
            />
          </Box>

          <Box flexDirection="column" rowGap="xs">
            <Text variant="label">
              Product or service description (optional)
            </Text>
            <Text variant="caption" color="muted">
              Describe what the customer purchased.
            </Text>
            <Textarea
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              placeholder="What did the customer receive?"
              className="min-h-24"
              maxLength={5000}
            />
          </Box>

          <Box flexDirection="column" rowGap="xs">
            <Text variant="label">Supporting evidence (optional)</Text>
            <Text variant="caption" color="muted">
              Upload receipts, shipping proof, or customer communication that
              supports your case.
            </Text>

            <div
              {...getRootProps()}
              className={twMerge(
                'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center',
                isDragActive
                  ? 'dark:border-polar-600 dark:bg-polar-800 border-blue-300 bg-blue-50'
                  : 'dark:border-polar-700 border-gray-200 bg-gray-50 dark:bg-transparent',
              )}
            >
              <input {...getInputProps()} />
              <p className="dark:text-polar-200 text-sm font-medium text-gray-700">
                {isDragActive
                  ? 'Drop files here'
                  : 'Drag & drop or click to upload'}
              </p>
              <p className="dark:text-polar-500 text-xs text-gray-500">
                PDF, images, or documents up to 25 MB
              </p>
            </div>

            {evidenceFiles.length > 0 && (
              <Box flexDirection="column" rowGap="xs">
                {evidenceFiles.map((file) => (
                  <Box
                    key={file.id}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="between"
                    columnGap="m"
                    padding="s"
                    borderRadius="m"
                    borderWidth={1}
                    borderStyle="solid"
                    borderColor="border-primary"
                  >
                    <Box flexDirection="column" flexGrow={1}>
                      <Text variant="caption">{file.name}</Text>
                      <Text variant="caption" color="muted">
                        {file.isUploading || file.isProcessing
                          ? `Uploading… ${Math.round((file.uploadedBytes / file.size) * 100)}%`
                          : formatBytes(file.size)}
                      </Text>
                    </Box>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="dark:text-polar-500 dark:hover:text-polar-200 text-gray-400 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box flexDirection="row" justifyContent="end" columnGap="m">
            <Link href={disputePath}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              loading={counterDispute.isPending}
              disabled={!isValid || isUploading}
            >
              Submit counter
            </Button>
          </Box>
        </Box>
      </form>
    </DashboardBody>
  )
}
