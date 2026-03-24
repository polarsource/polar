'use client'

import { useDraggable } from '@/hooks/draggable'
import { useBenefits } from '@/hooks/queries'
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [enabledPage, setEnabledPage] = useState(1)
  const [availablePage, setAvailablePage] = useState(1)
  const pageSize = 5
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setIsDropdownOpen(debouncedQuery.trim().length > 0)
  }, [debouncedQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedBenefitIds = useMemo(
    () => selectedBenefits.map((b) => b.id),
    [selectedBenefits],
  )

  const enabledBenefitsQuery = useBenefits(organization.id, {
    limit: pageSize,
    page: enabledPage,
    id: selectedBenefitIds.length > 0 ? selectedBenefitIds : undefined,
    sorting: ['user_order'],
  })

  const availableBenefitsQuery = useBenefits(organization.id, {
    limit: pageSize,
    page: availablePage,
    exclude_id: selectedBenefitIds.length > 0 ? selectedBenefitIds : undefined,
    sorting: ['-created_at'],
  })

  const searchResultsQuery = useBenefits(organization.id, {
    query: debouncedQuery,
    limit: 10,
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
  const searchResults = searchResultsQuery.data?.items ?? []

  useEffect(() => {
    setEnabledPage(1)
    setAvailablePage(1)
  }, [selectedBenefitIds.length])

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
      <div ref={searchContainerRef} className="relative">
        <Input
          preSlot={<Search className="h-4 w-4" />}
          placeholder="Search benefits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (debouncedQuery.trim().length > 0) {
              setIsDropdownOpen(true)
            }
          }}
        />

        {isDropdownOpen && (
          <div className="dark:border-polar-700 dark:bg-polar-900 absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {searchResultsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="dark:text-polar-500 py-8 text-center text-sm text-gray-500">
                No benefits found for &quot;{debouncedQuery}&quot;
              </div>
            ) : (
              <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-100">
                {searchResults.map((benefit) => (
                  <BenefitRow
                    key={benefit.id}
                    organization={organization}
                    benefit={benefit}
                    selected={selectedBenefits.some((s) => s.id === benefit.id)}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedBenefitIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="dark:text-polar-400 text-xs font-medium tracking-wide text-gray-500 uppercase">
              Enabled
              {enabledPagination && ` (${enabledPagination.total_count})`}
            </h4>
            {enabledPagination && enabledPagination.max_page > 1 && (
              <Pagination
                page={enabledPage}
                totalPages={enabledPagination.max_page}
                onPageChange={setEnabledPage}
              />
            )}
          </div>
          <div className="relative">
            {enabledBenefits.length === 0 &&
            !enabledBenefitsQuery.isFetching ? (
              <div className="dark:border-polar-700 dark:text-polar-500 rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-500">
                No enabled benefits
              </div>
            ) : (
              <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
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
            {enabledBenefitsQuery.isFetching && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/50">
                <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="dark:text-polar-400 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Available
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
        <div className="relative">
          {availableBenefits.length === 0 &&
          !availableBenefitsQuery.isFetching ? (
            <div className="dark:border-polar-700 dark:text-polar-500 rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-500">
              No benefits available
            </div>
          ) : (
            <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
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
          {availableBenefitsQuery.isFetching && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/50">
              <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
