'use client'

import CreateBenefitModalContent from '@/components/Benefit/CreateBenefitModalContent'
import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useInfiniteBenefits } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const BenefitListSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'created_at',
      'description',
      '-description',
    ] as const).withDefault('-created_at'),
  )

  const [query, setQuery] = useQueryState('query', parseAsString)

  const [createBenefitQuerystring, setCreateBenefitQuerystring] = useQueryState(
    'create_benefit',
    parseAsBoolean.withDefault(false),
  )

  const { data, fetchNextPage, hasNextPage } = useInfiniteBenefits(
    organization.id,
    {
      query: query ?? undefined,
      sorting: [sorting],
    },
  )

  const benefits = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  )

  const {
    isShown: isCreateBenefitModalShown,
    toggle: toggleCreateBenefitModal,
    hide: hideCreateBenefitModal,
    show: showCreateBenefitModal,
  } = useModal(false)

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (createBenefitQuerystring) {
      showCreateBenefitModal()
      setCreateBenefitQuerystring(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createBenefitQuerystring])

  const selectedBenefitId = useMemo(() => {
    const parts = pathname.split('/')
    const benefitIndex = parts.indexOf('benefits')
    if (benefitIndex !== -1 && parts[benefitIndex + 1]) {
      return parts[benefitIndex + 1]
    }
    return null
  }, [pathname])

  return (
    <>
      <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
        <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
          <div>Benefits</div>
          <div className="flex flex-row items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                setSorting(
                  sorting === '-created_at' ? 'created_at' : '-created_at',
                )
              }
            >
              {sorting === 'created_at' ? (
                <ArrowUpward fontSize="small" />
              ) : (
                <ArrowDownward fontSize="small" />
              )}
            </Button>
            <Button
              size="icon"
              className="h-6 w-6"
              onClick={toggleCreateBenefitModal}
            >
              <AddOutlined fontSize="small" />
            </Button>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3 px-4 py-2">
          <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
            <Search
              fontSize="inherit"
              className="dark:text-polar-500 text-gray-500"
            />
          </div>
          <Input
            className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
            placeholder="Search Benefits"
            value={query ?? undefined}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
          {benefits.map((benefit) => {
            const queryString = searchParams.toString()
            const benefitHref = `/dashboard/${organization.slug}/products/benefits/${benefit.id}${queryString ? `?${queryString}` : ''}`

            return (
              <Link
                key={benefit.id}
                href={benefitHref}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedBenefitId === benefit.id &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-gray-200 text-2xl text-black dark:text-white">
                    {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <div className="w-full truncate text-sm">
                      {benefit.description}
                    </div>
                    <div className="dark:text-polar-500 w-full truncate text-xs text-gray-500">
                      {benefitsDisplayNames[benefit.type]}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {hasNextPage && (
            <div
              ref={loadingRef}
              className="flex w-full items-center justify-center py-8"
            >
              <Spinner />
            </div>
          )}
        </div>
      </div>
      <InlineModal
        isShown={isCreateBenefitModalShown}
        hide={hideCreateBenefitModal}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hideCreateBenefitModal}
            onSelectBenefit={(benefit) => {
              hideCreateBenefitModal()
              window.location.href = `/dashboard/${organization.slug}/products/benefits/${benefit.id}`
            }}
          />
        }
      />
    </>
  )
}
