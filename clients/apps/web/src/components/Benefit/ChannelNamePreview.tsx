import { usePreviewSlackChannelName } from '@/hooks/queries'
import useDebounce from '@/utils/useDebounce'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'

interface Props {
  template: string
  organizationId: string
}

export const ChannelNamePreview = ({ template, organizationId }: Props) => {
  const { mutateAsync } = usePreviewSlackChannelName()
  const [rendered, setRendered] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debouncedTemplate = useDebounce(template, 250)

  useEffect(() => {
    if (!debouncedTemplate) return
    let cancelled = false
    mutateAsync({
      organization_id: organizationId,
      template: debouncedTemplate,
      customer_name: 'Sample Customer',
      customer_email: 'customer@example.com',
    })
      .then((result) => {
        if (cancelled) return
        if (result.error) {
          const detail = Array.isArray(result.error.detail)
            ? result.error.detail[0]?.msg
            : undefined
          const message =
            typeof detail === 'string' ? detail : 'Invalid template'
          setError(message)
          setRendered(null)
          return
        }
        setError(null)
        setRendered(result.data?.channel_name ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not render the preview')
        setRendered(null)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedTemplate, organizationId, mutateAsync])

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
