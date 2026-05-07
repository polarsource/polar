'use client'

import { useDraggable } from '@/hooks/draggable'
import { useBenefits } from '@/hooks/queries'
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BenefitRow } from './components/BenefitRow'
import { Pagination } from './components/Pagination'
import { SortableBenefitRow } from './components/SortableBenefitRow'

interface Props {
  organization: schemas['Organization']
  selectedBenefits: schemas['Benefit'][]
  onSelectBenefit: (benefit: schemas['Benefit']) => void
  onRemoveBenefit: (benefit: schemas['Benefit']) => void
  onReorderBenefits?: (benefits: schemas['Benefit'][]) => void
  isReorderMode: boolean
}

export const BenefitSearchComplex = ({
  organization,
  selectedBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  onReorderBenefits,
  isReorderMode,
}: Props) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [enabledPage, setEnabledPage] = useState(1)
  const [availablePage, setAvailablePage] = useState(1)
  const pageSize = 5
  const trimmedQuery = debouncedQuery.trim()
  const hasQuery = trimmedQuery.length > 0

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setAvailablePage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const selectedBenefitIds = useMemo(
    () => selectedBenefits.map((b) => b.id),
    [selectedBenefits],
  )

  // Gate the orgId to disable the query when nothing is selected: passing
  // `id: []` would make the backend return *all* benefits, which then flashes
  // through `keepPreviousData` on the first toggle.
  const enabledBenefitsQuery = useBenefits(
    selectedBenefitIds.length > 0 ? organization.id : undefined,
    {
      limit: pageSize,
      page: enabledPage,
      id: selectedBenefitIds,
      query: hasQuery ? trimmedQuery : undefined,
      sorting: ['user_order'],
    },
  )

  const availableBenefitsQuery = useBenefits(organization.id, {
    limit: pageSize,
    page: availablePage,
    exclude_id: selectedBenefitIds.length > 0 ? selectedBenefitIds : undefined,
    query: hasQuery ? trimmedQuery : undefined,
    sorting: ['-created_at'],
  })

  const handleToggle = useCallback(
    (benefit: schemas['Benefit'], checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [onSelectBenefit, onRemoveBenefit],
  )

  const enabledBenefits = enabledBenefitsQuery.data?.items ?? []
  const enabledPagination = enabledBenefitsQuery.data?.pagination

  const availableBenefits = availableBenefitsQuery.data?.items ?? []
  const availablePagination = availableBenefitsQuery.data?.pagination

  useEffect(() => {
    if (
      enabledPagination &&
      enabledPagination.max_page > 0 &&
      enabledPage > enabledPagination.max_page
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabledPage(enabledPagination.max_page)
    }
  }, [enabledPagination, enabledPage])

  useEffect(() => {
    if (
      availablePagination &&
      availablePagination.max_page > 0 &&
      availablePage > availablePagination.max_page
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailablePage(availablePagination.max_page)
    }
  }, [availablePagination, availablePage])

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(
    selectedBenefits,
    (updatedBenefits) => {
      onReorderBenefits?.(updatedBenefits)
    },
    () => {},
  )

  const activeBenefit = useMemo(
    () =>
      activeId ? selectedBenefits.find((b) => b.id === activeId) : undefined,
    [activeId, selectedBenefits],
  )

  if (isReorderMode) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={selectedBenefits}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {selectedBenefits.map((benefit) => (
              <SortableBenefitRow
                key={benefit.id}
                benefit={benefit}
                onRemove={() => onRemoveBenefit(benefit)}
              />
            ))}
          </div>
          <DragOverlay adjustScale={true}>
            {activeBenefit ? (
              <SortableBenefitRow benefit={activeBenefit} onRemove={() => {}} />
            ) : null}
          </DragOverlay>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center gap-2">
        <Input
          preSlot={<Search className="h-4 w-4" />}
          placeholder="Search benefits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-5.5 items-center justify-between">
          <h4 className="dark:text-polar-400 text-xs font-medium tracking-wide text-gray-500 uppercase">
            {hasQuery
              ? `Available benefits matching "${trimmedQuery}"`
              : 'Available'}
            {availablePagination && ` (${availablePagination.total_count})`}
          </h4>
          {availablePagination && availablePagination.max_page > 1 && (
            <Pagination
              page={availablePage}
              totalPages={availablePagination.max_page}
              onPageChange={setAvailablePage}
            />
          )}
        </div>
        {availableBenefitsQuery.isPending ? (
          <div className="dark:border-polar-700 flex h-15.5 items-center justify-center rounded-xl border border-gray-200">
            <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : availableBenefits.length === 0 ? (
          <div className="dark:border-polar-700 dark:text-polar-500 flex h-[62px] items-center justify-center rounded-xl border border-gray-200 px-4 text-center text-sm text-gray-500">
            {hasQuery
              ? `No benefits found for "${trimmedQuery}"`
              : 'No benefits available'}
          </div>
        ) : (
          <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-100 overflow-clip rounded-xl border border-gray-200">
            {availableBenefits.map((benefit) => (
              <BenefitRow
                key={benefit.id}
                organization={organization}
                benefit={benefit}
                selected={false}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-5.5 items-center justify-between">
          <h4 className="dark:text-polar-400 text-xs font-medium tracking-wide text-gray-500 uppercase">
            {hasQuery
              ? `Enabled benefits matching "${trimmedQuery}"`
              : 'Enabled'}
            {` (${enabledPagination?.total_count ?? selectedBenefits.length})`}
          </h4>
          {selectedBenefitIds.length > 0 &&
            enabledPagination &&
            enabledPagination.max_page > 1 && (
              <Pagination
                page={enabledPage}
                totalPages={enabledPagination.max_page}
                onPageChange={setEnabledPage}
              />
            )}
        </div>
        {selectedBenefitIds.length === 0 ? (
          <div className="dark:border-polar-700 dark:text-polar-500 flex h-15.5 items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 text-center text-sm text-gray-500">
            Toggle a benefit above to enable it for this product
          </div>
        ) : enabledBenefitsQuery.isPending ? (
          <div className="dark:border-polar-700 flex h-15.5 items-center justify-center rounded-xl border border-gray-200">
            <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : enabledBenefits.length === 0 ? (
          <div className="dark:border-polar-700 dark:text-polar-500 flex h-15.5 items-center justify-center rounded-xl border border-gray-200 px-4 text-center text-sm text-gray-500">
            {`No enabled benefits match "${trimmedQuery}"`}
          </div>
        ) : (
          <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-100 overflow-clip rounded-xl border border-gray-200">
            {enabledBenefits.map((benefit) => (
              <BenefitRow
                key={benefit.id}
                organization={organization}
                benefit={benefit}
                selected={true}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
