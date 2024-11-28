'use client'

import CreateBenefitModalContent from '@/components/Benefit/CreateBenefitModalContent'
import { resolveBenefitTypeDisplayName } from '@/components/Benefit/utils'
import { ContextBody } from '@/components/Dashboard/ContextBody'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useBenefits } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { AddOutlined } from '@mui/icons-material'
import { useSearchParams } from 'next/navigation'
import { useQueryState } from 'nuqs'
import Button from 'polarkit/components/ui/atoms/button'
import { useContext, useEffect, useMemo } from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [selectedBenefitId, setSelectedBenefitId] = useQueryState('benefitId')

  const { organization } = useContext(MaintainerOrganizationContext)
  const { data: benefits } = useBenefits(organization.id, 100)
  const searchParams = useSearchParams()

  const { isShown, toggle, hide } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

  const selectedBenefit = useMemo(() => {
    return benefits?.items.find((b) => b.id === selectedBenefitId)
  }, [selectedBenefitId, benefits])

  useEffect(() => {
    const benefitId = benefits?.items[0]?.id
    if (!selectedBenefit && benefitId) {
      setSelectedBenefitId(benefitId)
    }
  }, [benefits])

  const sortedBenefits =
    benefits?.items.sort((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? -1 : 1,
    ) ?? []

  return (
    <ContextBody
      items={
        sortedBenefits.map((benefit) => ({
          id: benefit.id,
          title: benefit.description,
          description: resolveBenefitTypeDisplayName(benefit.type),
          active: selectedBenefit?.id === benefit.id,
          onSelect: setSelectedBenefitId,
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
            onSelectBenefit={(benefit) => {
              setSelectedBenefitId(benefit.id)
              hide()
            }}
          />
        }
      />
    </ContextBody>
  )
}
