'use client'

import CreateBenefitModalContent from '@/components/Benefit/CreateBenefitModalContent'
import { resolveBenefitTypeDisplayName } from '@/components/Benefit/utils'
import { ContextBody } from '@/components/Dashboard/ContextBody'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useBenefits } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { AddOutlined } from '@mui/icons-material'
import { BenefitPublicInner } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useContext, useEffect, useState } from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitPublicInner>()

  const { organization } = useContext(MaintainerOrganizationContext)
  const { data: benefits } = useBenefits(organization.id, 100)
  const searchParams = useSearchParams()

  const { isShown, toggle, hide } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

  useEffect(() => {
    setSelectedBenefit(benefits?.items[0])
  }, [benefits])

  return (
    <ContextBody
      items={
        benefits?.items.map((benefit) => ({
          id: benefit.id,
          title: benefit.description,
          description: resolveBenefitTypeDisplayName(benefit.type),
          active: selectedBenefit?.id === benefit.id,
          onSelect: (id) =>
            setSelectedBenefit(benefits?.items.find((b) => b.id === id)),
        })) ?? []
      }
      cta={
        <Button onClick={toggle} size="icon">
          <AddOutlined fontSize="inherit" />
        </Button>
      }
    >
      {children}

      <InlineModal
        isShown={isShown}
        hide={toggle}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hide}
            onSelectBenefit={hide}
          />
        }
      />
    </ContextBody>
  )
}
