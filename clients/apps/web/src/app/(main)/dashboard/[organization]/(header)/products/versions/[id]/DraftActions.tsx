'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useDiscardCatalog, usePublishCatalog } from '@/hooks/queries/catalogs'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'

const failed = (action: string) => (error: unknown) =>
  toast({
    title: `Could not ${action} the draft`,
    description:
      error instanceof Error ? error.message : 'Please try again in a moment.',
  })

export const DraftActions = ({
  catalogId,
  versionsPath,
}: {
  catalogId: string
  versionsPath: string
}) => {
  const router = useRouter()
  const publishModal = useModal()
  const discardModal = useModal()
  const publish = usePublishCatalog()
  const discard = useDiscardCatalog()

  return (
    <Box flexDirection="column" rowGap="s">
      <Text color="muted">
        Not live yet. New checkouts keep using the current version until you
        publish this draft.
      </Text>
      <Box columnGap="m">
        <Button onClick={publishModal.show} loading={publish.isPending}>
          Publish
        </Button>
        <Button
          variant="secondary"
          onClick={discardModal.show}
          loading={discard.isPending}
        >
          Discard
        </Button>
      </Box>
      <ConfirmModal
        isShown={publishModal.isShown}
        hide={publishModal.hide}
        title="Publish this draft?"
        description="New checkouts will use its products and benefits. Existing customers stay on their versions until you move them."
        destructiveText="Publish"
        onConfirm={() =>
          publish.mutateAsync(catalogId).catch(failed('publish'))
        }
      />
      <ConfirmModal
        isShown={discardModal.isShown}
        hide={discardModal.hide}
        title="Discard this draft?"
        description="Its changes are deleted. The current version doesn't change."
        destructive
        destructiveText="Discard"
        onConfirm={() =>
          discard
            .mutateAsync(catalogId)
            .then(() => router.push(versionsPath))
            .catch(failed('discard'))
        }
      />
    </Box>
  )
}
