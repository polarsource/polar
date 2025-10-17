import { useDraggable } from '@/hooks/draggable'
import { useDeleteBenefit } from '@/hooks/queries'
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Close from '@mui/icons-material/Close'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CreateBenefitModalContent from '../Benefit/CreateBenefitModalContent'
import UpdateBenefitModalContent from '../Benefit/UpdateBenefitModalContent'
import {
  benefitsDisplayNames,
  CreatableBenefit,
  resolveBenefitCategoryIcon,
} from '../Benefit/utils'
import { Section } from '../Layout/Section'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { toast } from '../Toast/use-toast'

interface BenefitRowProps {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const BenefitRow = ({
  organization,
  benefit,
  checked,
  onCheckedChange,
}: BenefitRowProps) => {
  const {
    isShown: isEditShown,
    toggle: toggleEdit,
    hide: hideEdit,
  } = useModal()
  const {
    isShown: isDeleteShown,
    hide: hideDelete,
    toggle: toggleDelete,
  } = useModal()

  const deleteBenefit = useDeleteBenefit(organization.id)

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Benefit Deletion Failed',
          description: `Error deleting benefit: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Benefit Deleted',
        description: `Benefit ${benefit.description} was deleted successfully`,
      })
    })
  }, [deleteBenefit, benefit])

  return (
    <div
      className={twMerge('flex w-full flex-row items-center justify-between')}
    >
      <div className="flex flex-row items-center gap-x-3">
        <span
          className={twMerge(
            'flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full',
            checked
              ? 'dark:bg-polar-700 bg-blue-50 text-blue-500 dark:text-white'
              : 'dark:bg-polar-800 dark:text-polar-500 bg-gray-200 text-gray-500',
          )}
        >
          {checked ? (
            <CheckOutlined fontSize="inherit" />
          ) : (
            <RemoveOutlined fontSize="inherit" />
          )}
        </span>
        <span
          className={twMerge('text-sm', checked ? 'opacity-100' : 'opacity-50')}
        >
          {benefit.description}
        </span>
      </div>
      <div className="flex flex-row items-center gap-x-2 text-[14px]">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={!benefit.selectable}
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none" asChild>
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
            >
              <MoreVertOutlined fontSize="inherit" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dark:bg-polar-800 bg-gray-50 shadow-lg"
          >
            <DropdownMenuItem onClick={toggleEdit}>Edit</DropdownMenuItem>
            {benefit.deletable && (
              <DropdownMenuItem onClick={toggleDelete}>Delete</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <InlineModal
        isShown={isEditShown}
        hide={hideEdit}
        modalContent={
          <UpdateBenefitModalContent
            organization={organization}
            benefit={benefit}
            hideModal={hideEdit}
          />
        }
      />
      <ConfirmModal
        isShown={isDeleteShown}
        hide={hideDelete}
        title="Delete Benefit"
        description="Deleting a benefit will remove it from every Products & revoke it for existing customers. Are you sure?"
        onConfirm={handleDeleteBenefit}
        destructive
      />
    </div>
  )
}

interface SortableBenefitRowProps {
  benefit: schemas['Benefit']
  onRemove: () => void
}

const SortableBenefitRow = ({ benefit, onRemove }: SortableBenefitRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: benefit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-700 flex w-full flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-3',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex flex-row items-center gap-x-3">
        <button
          className="dark:text-polar-500 dark:hover:text-polar-300 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DragIndicatorOutlined fontSize="small" />
        </button>
        <span
          className={twMerge(
            'dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:text-white',
          )}
        >
          <CheckOutlined fontSize="inherit" />
        </span>
        <span className="text-sm">{benefit.description}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={onRemove}>
        <Close fontSize="small" />
      </Button>
    </div>
  )
}

const DraggableSortableBenefitRow = ({
  benefit,
  onRemove,
}: SortableBenefitRowProps) => {
  return <SortableBenefitRow benefit={benefit} onRemove={onRemove} />
}

interface ProductBenefitsFormProps {
  organization: schemas['Organization']
  benefits: schemas['Benefit'][]
  organizationBenefits: schemas['Benefit'][]
  onSelectBenefit: (benefit: schemas['Benefit']) => void
  onRemoveBenefit: (benefit: schemas['Benefit']) => void
  onReorderBenefits?: (benefits: schemas['Benefit'][]) => void
  className?: string
  compact?: boolean
}

const ProductBenefitsForm = ({
  className,
  benefits,
  organization,
  organizationBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  onReorderBenefits,
  compact,
}: ProductBenefitsFormProps) => {
  const searchParams = useSearchParams()
  const [type, setType] = useState<CreatableBenefit | undefined>()
  const [isReorderMode, setIsReorderMode] = useState(false)
  const { isShown, toggle, hide, show } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(
    benefits,
    (updatedBenefits) => {
      onReorderBenefits?.(updatedBenefits)
    },
    () => {},
  )

  const handleCheckedChange = useCallback(
    (benefit: schemas['Benefit']) => (checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [onSelectBenefit, onRemoveBenefit],
  )

  const activeBenefit = useMemo(
    () => (activeId ? benefits.find((b) => b.id === activeId) : undefined),
    [activeId, benefits],
  )

  const toggleReorderMode = () => {
    setIsReorderMode(!isReorderMode)
  }

  const hasEnabledBenefits = benefits.length > 0

  return (
    <Section
      title="Automated Benefits"
      description="Configure which benefits you want to grant to your customers when they
      purchase the product"
      className={className}
      compact={compact}
    >
      <div className="flex w-full flex-col gap-y-4">
        {hasEnabledBenefits && onReorderBenefits && (
          <div className="flex items-center justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleReorderMode}
              className="self-start"
            >
              {isReorderMode ? 'Done' : 'Reorder '}
            </Button>
          </div>
        )}

        {isReorderMode && hasEnabledBenefits ? (
          <div className="flex flex-col gap-y-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Enabled Benefits Order
            </h4>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={benefits}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-y-2">
                  {benefits.map((benefit) => (
                    <DraggableSortableBenefitRow
                      key={benefit.id}
                      benefit={benefit}
                      onRemove={() => onRemoveBenefit(benefit)}
                    />
                  ))}
                </div>
                <DragOverlay adjustScale={true}>
                  {activeBenefit ? (
                    <SortableBenefitRow
                      benefit={activeBenefit}
                      onRemove={() => {}}
                    />
                  ) : null}
                </DragOverlay>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-y-2">
            {enums.benefitTypeValues.map((type) => (
              <BenefitsContainer
                key={type}
                organization={organization}
                title={benefitsDisplayNames[type]}
                type={type}
                handleCheckedChange={handleCheckedChange}
                enabledBenefits={benefits}
                benefits={organizationBenefits.filter(
                  (benefit) => benefit.type === type,
                )}
                onCreateNewBenefit={() => {
                  setType(type as CreatableBenefit)
                  show()
                }}
              />
            ))}
          </div>
        )}
      </div>
      <InlineModal
        isShown={isShown}
        hide={toggle}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hide}
            defaultValues={type ? { type } : undefined}
            onSelectBenefit={(benefit) => {
              onSelectBenefit(benefit)
              hide()
            }}
          />
        }
      />
    </Section>
  )
}

interface BenefitsContainerProps {
  organization: schemas['Organization']
  title: string
  benefits: schemas['Benefit'][]
  enabledBenefits: schemas['Benefit'][]
  handleCheckedChange: (
    benefit: schemas['Benefit'],
  ) => (checked: boolean) => void
  type: schemas['BenefitType']
  onCreateNewBenefit?: () => void
}

const BenefitsContainer = ({
  organization,
  title,
  benefits,
  enabledBenefits,
  handleCheckedChange,
  onCreateNewBenefit,
  type,
}: BenefitsContainerProps) => {
  const hasEnabledBenefits = benefits.some((benefit) => {
    return enabledBenefits.some((b) => b.id === benefit.id)
  })
  const [open, setOpen] = useState(hasEnabledBenefits)

  if (benefits.length === 0 && !onCreateNewBenefit) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={twMerge(
          'dark:bg-polar-800 dark:hover:border-polar-700 group flex cursor-pointer flex-row items-center justify-between gap-2 rounded-xl border border-transparent bg-gray-100 px-4 py-3 text-sm transition-colors hover:border-gray-200 dark:border-transparent',
        )}
        onClick={() => setOpen((v) => !v)}
        role="button"
      >
        <div className="flex flex-row items-center gap-x-3">
          {resolveBenefitCategoryIcon(type, 'h-4 w-4')}
          <span>{title}</span>
        </div>
        <span className="flex flex-row items-center gap-x-4">
          {hasEnabledBenefits ? (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          ) : null}
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            {benefits.length}
          </span>
          {open ? (
            <ChevronUpIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
          )}
        </span>
      </div>
      {open ? (
        <div className="dark:border-polar-700 mb-2 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-4">
          {benefits.length > 0 ? (
            <div className="flex flex-col">
              {benefits.map((benefit) => {
                return (
                  <BenefitRow
                    key={benefit.id}
                    organization={organization}
                    benefit={benefit}
                    checked={enabledBenefits.some((b) => b.id === benefit.id)}
                    onCheckedChange={handleCheckedChange(benefit)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              <p className="dark:text-polar-500 text-sm text-gray-500">
                You haven&apos;t configured any {title}
              </p>
            </div>
          )}
          {onCreateNewBenefit && (
            <Button
              className="self-start"
              variant="secondary"
              onClick={onCreateNewBenefit}
              type="button"
              size="sm"
              wrapperClassNames="gap-x-2"
            >
              <AddOutlined fontSize="inherit" />
              <span>Create New</span>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default ProductBenefitsForm
