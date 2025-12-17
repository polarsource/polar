'use client'

import {
  benefitsDisplayNames,
  CreatableBenefit,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import CreateBenefitModalContent from '../../Benefit/CreateBenefitModalContent'
import { Section } from '../../Layout/Section'
import { InlineModal } from '../../Modal/InlineModal'
import { BenefitSearchComplex } from './BenefitSearchComplex'
import { BenefitSearchSimple } from './BenefitSearchSimple'

const SIMPLIFIED_VIEW_THRESHOLD = 20

interface BenefitSearchProps {
  organization: schemas['Organization']
  benefits: schemas['Benefit'][]
  totalBenefitCount: number
  selectedBenefits: schemas['Benefit'][]
  onSelectBenefit: (benefit: schemas['Benefit']) => void
  onRemoveBenefit: (benefit: schemas['Benefit']) => void
  onReorderBenefits?: (benefits: schemas['Benefit'][]) => void
  className?: string
}

export const Benefits = ({
  organization,
  benefits,
  totalBenefitCount,
  selectedBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  onReorderBenefits,
  className,
}: BenefitSearchProps) => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createBenefitType, setCreateBenefitType] = useState<
    CreatableBenefit | undefined
  >()
  const [isReorderMode, setIsReorderMode] = useState(false)

  const hasSelectedBenefits = selectedBenefits.length > 0
  const isSimplifiedView = totalBenefitCount <= SIMPLIFIED_VIEW_THRESHOLD

  return (
    <Section
      title="Automated Benefits"
      description="Configure which benefits you want to grant to your customers when they purchase the product"
      className={className}
    >
      <div className="flex flex-col gap-4">
        {isSimplifiedView ? (
          <BenefitSearchSimple
            organization={organization}
            benefits={benefits}
            selectedBenefits={selectedBenefits}
            onSelectBenefit={onSelectBenefit}
            onRemoveBenefit={onRemoveBenefit}
            onReorderBenefits={onReorderBenefits}
            isReorderMode={isReorderMode}
          />
        ) : (
          <BenefitSearchComplex
            organization={organization}
            selectedBenefits={selectedBenefits}
            onSelectBenefit={onSelectBenefit}
            onRemoveBenefit={onRemoveBenefit}
            onReorderBenefits={onReorderBenefits}
            isReorderMode={isReorderMode}
          />
        )}

        <div className="flex items-center gap-2">
          {!isReorderMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <div className="flex items-center gap-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Create Benefit</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {enums.benefitTypeValues.map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      setCreateBenefitType(type as CreatableBenefit)
                      setCreateModalOpen(true)
                    }}
                    className="flex items-center gap-2"
                  >
                    {resolveBenefitIcon(type, 'h-4 w-4')}
                    <span>{benefitsDisplayNames[type]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasSelectedBenefits && onReorderBenefits && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </Button>
          )}
        </div>
      </div>

      <InlineModal
        isShown={createModalOpen}
        hide={() => setCreateModalOpen(false)}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={() => setCreateModalOpen(false)}
            defaultValues={
              createBenefitType ? { type: createBenefitType } : undefined
            }
            onSelectBenefit={() => {
              setCreateModalOpen(false)
            }}
          />
        }
      />
    </Section>
  )
}
