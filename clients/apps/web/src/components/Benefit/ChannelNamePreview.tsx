import { usePreviewSlackChannelName } from '@/hooks/queries'
import useDebounce from '@/utils/useDebounce'
import { ClientResponseError } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const getTemplateErrorMessage = (detail: unknown): string => {
  const message = Array.isArray(detail) ? detail[0]?.msg : undefined
  return typeof message === 'string' ? message : 'Invalid template'
}

interface Props {
  template: string
  organizationId: string
}

export const ChannelNamePreview = ({ template, organizationId }: Props) => {
  const debouncedTemplate = useDebounce(template, 250)
  const { data: preview, error: previewError } = usePreviewSlackChannelName({
    organization_id: organizationId,
    template: debouncedTemplate,
    customer_name: 'Sample Customer',
    customer_email: 'customer@example.com',
  })

  const error = !previewError
    ? null
    : previewError instanceof ClientResponseError
      ? getTemplateErrorMessage(previewError.error.detail)
      : 'Could not render the preview'
  const rendered = previewError ? null : (preview?.channel_name ?? null)

  if (!template || !debouncedTemplate) return null

  return (
    <Box marginTop="xs">
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : rendered ? (
        <Text variant="caption" color="muted">
          Preview: <code>#{rendered}</code> (metadata placeholders shown as
          their key name; real customers will use their actual values)
        </Text>
      ) : null}
    </Box>
  )
}
