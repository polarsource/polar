'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateProducts } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'

export type BulkArchiveAction = 'archive' | 'unarchive'

const productCount = (count: number) =>
  `${count} ${count === 1 ? 'product' : 'products'}`

const COPY = {
  archive: {
    label: 'Archive',
    pastTense: 'archived',
    description:
      'This will not affect current customers, only prevent new purchases.',
    error: 'Could not archive products',
  },
  unarchive: {
    label: 'Unarchive',
    pastTense: 'unarchived',
    description: 'This will make them available for new purchases again.',
    error: 'Could not unarchive products',
  },
} as const

export const BulkArchiveProductsModal = ({
  action,
  products,
  hide,
  onComplete,
}: {
  action: BulkArchiveAction
  products: schemas['Product'][]
  hide: () => void
  onComplete: () => void
}) => {
  const updateProducts = useUpdateProducts()
  const copy = COPY[action]
  const isArchiving = action === 'archive'

  const handleConfirm = async () => {
    try {
      const { succeeded, failed } = await updateProducts.mutateAsync({
        products,
        body: { is_archived: isArchiving },
      })
      toast({
        title:
          failed.length > 0
            ? `${productCount(succeeded.length)} ${copy.pastTense}, ${failed.length} failed`
            : `${productCount(succeeded.length)} ${copy.pastTense}`,
      })
    } catch {
      toast({ title: copy.error })
    } finally {
      onComplete()
    }
  }

  return (
    <ConfirmModal
      isShown
      hide={hide}
      title={`${copy.label} ${productCount(products.length)}`}
      description={copy.description}
      onConfirm={handleConfirm}
      destructive={isArchiving}
      destructiveText={copy.label}
    />
  )
}
