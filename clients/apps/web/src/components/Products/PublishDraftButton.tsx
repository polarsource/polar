import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { usePublishCatalog } from '@/hooks/queries/catalogs'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Button } from '@polar-sh/orbit'

export const PublishDraftButton = ({ catalogId }: { catalogId: string }) => {
  const { isShown, show, hide } = useModal()
  const publish = usePublishCatalog()

  const onConfirm = async () => {
    const { data, error } = await publish.mutateAsync(catalogId)
    if (error) {
      toast({
        title: 'Could not publish version',
        description: extractApiErrorMessage(error),
      })
      return
    }
    toast({
      title: `${data.name ?? 'Version'} published`,
      description: 'New checkouts now use this version.',
    })
  }

  return (
    <>
      <Button onClick={show}>Publish</Button>
      <ConfirmModal
        isShown={isShown}
        hide={hide}
        onConfirm={onConfirm}
        title="Publish this version?"
        description="New checkouts will use its products and benefits. Existing customers stay on their current versions until moved."
      />
    </>
  )
}
