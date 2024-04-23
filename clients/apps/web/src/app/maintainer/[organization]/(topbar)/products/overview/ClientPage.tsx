'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateProductModal } from '@/components/Products/CreateProductModal'
import { AddOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'

export default function ClientPage() {
  const {
    isShown: isCreateProductModalShown,
    hide: hideCreateProductModal,
    show: showCreateProductModal,
  } = useModal()

  return (
    <DashboardBody>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-lg">Overview</h1>
        <Button size="icon" onClick={showCreateProductModal}>
          <AddOutlined className="h-4 w-4" />
        </Button>
      </div>
      <InlineModal
        isShown={isCreateProductModalShown}
        hide={hideCreateProductModal}
        modalContent={<CreateProductModal hide={hideCreateProductModal} />}
      />
    </DashboardBody>
  )
}
