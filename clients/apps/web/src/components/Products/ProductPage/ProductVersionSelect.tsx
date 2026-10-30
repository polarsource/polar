import { useIsManagedAsCode } from '@/hooks/permissions'
import {
  type ProductVersion,
  useProductVersions,
} from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Check,
  ChevronDown,
  ChevronRight,
  PeopleAltOutlined,
} from '@polar-sh/orbit/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { ReactNode } from 'react'
import { formatPublishedAt } from './ProductVersionBanner'

const pluralize = (count: number, noun: string) =>
  `${count.toLocaleString()} ${count === 1 ? noun : `${noun}s`}`

const SectionLabel = ({
  children,
  action,
}: {
  children: string
  action?: ReactNode
}) => (
  <Box
    justifyContent="between"
    alignItems="center"
    paddingHorizontal="m"
    paddingTop="m"
    paddingBottom="xs"
  >
    <Text variant="caption" color="muted">
      {children}
    </Text>
    {action}
  </Box>
)

const VersionRow = ({
  organization,
  version,
  selected,
}: {
  organization: schemas['Organization']
  version: ProductVersion
  selected: boolean
}) => {
  const count = version.active_subscriptions_count
  return (
    <DropdownMenuItem
      asChild
      className="dark:focus:bg-polar-800 gap-3 rounded-md px-2 py-2 focus:bg-gray-100"
    >
      <Link
        href={`/dashboard/${organization.slug}/products/${version.product_id}`}
      >
        <Box alignItems="center" columnGap="s" flex={1} minWidth={0}>
          <Text truncate variant={selected ? 'title' : 'default'}>
            {version.name ?? 'Untitled'}
          </Text>
          {selected ? <Check className="size-3.5! shrink-0" /> : null}
        </Box>
        <Box
          alignItems="center"
          columnGap="xs"
          aria-label={pluralize(count, 'subscription')}
        >
          <Text as="span" color={count ? 'muted' : 'disabled'}>
            <PeopleAltOutlined sx={{ fontSize: 14, display: 'block' }} />
          </Text>
          {/* Fixed widths keep the icon and date columns aligned across rows. */}
          <Box width={16} justifyContent="end">
            <Text tabularNums color={count ? 'default' : 'disabled'}>
              {count}
            </Text>
          </Box>
        </Box>
        <Box width={44} justifyContent="end">
          <Text variant="caption" color="muted" tabularNums wrap="nowrap">
            {formatPublishedAt(version.published_at)}
          </Text>
        </Box>
      </Link>
    </DropdownMenuItem>
  )
}

export const ProductVersionSelect = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: versions } = useProductVersions(
    organization.id,
    product,
    managedAsCode,
  )
  const selected = versions?.find(
    (version) => version.product_id === product.id,
  )

  if (!versions || !selected) {
    return null
  }

  const viewAll = (
    <DropdownMenuItem
      asChild
      className="dark:text-polar-500 gap-1 rounded-md p-0 text-xs text-gray-500 focus:bg-transparent focus:text-gray-950 dark:focus:bg-transparent dark:focus:text-white [&_svg]:size-3.5!"
    >
      <Link href={`/dashboard/${organization.slug}/products/versions`}>
        View all
        <ChevronRight />
      </Link>
    </DropdownMenuItem>
  )
  const current = versions.find((version) => version.is_current)
  const previous = versions.filter((version) => !version.is_current)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Matches the Orbit SelectTrigger, which only works inside a Radix Select. */}
        <button
          type="button"
          className="dark:bg-polar-800 dark:hover:border-polar-600 dark:border-polar-700 flex h-10 cursor-pointer items-center gap-x-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-black shadow-xs transition-colors hover:border-gray-300 dark:text-white"
        >
          <span>
            {selected.name ?? 'Untitled'}{' '}
            <span className="dark:text-polar-500 text-gray-500">
              ·{' '}
              {selected.is_current
                ? 'Current'
                : formatPublishedAt(selected.published_at)}
            </span>
          </span>
          <ChevronDown size={16} className="opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[320px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-2xl p-0 duration-150"
      >
        {/* Height cuts through a row so it's obvious the list scrolls. */}
        <Box flexDirection="column" maxHeight={440} overflowY="auto">
          {current ? (
            <>
              <SectionLabel action={viewAll}>Current version</SectionLabel>
              <Box
                flexDirection="column"
                paddingHorizontal="xs"
                paddingBottom="xs"
              >
                <VersionRow
                  organization={organization}
                  version={current}
                  selected={current.product_id === product.id}
                />
              </Box>
            </>
          ) : null}
          {previous.length > 0 ? (
            <>
              <SectionLabel action={current ? undefined : viewAll}>
                {current ? 'Previous versions' : 'Versions'}
              </SectionLabel>
              <Box
                flexDirection="column"
                paddingHorizontal="xs"
                paddingBottom="xs"
              >
                {previous.map((version) => (
                  <VersionRow
                    key={version.product_id}
                    organization={organization}
                    version={version}
                    selected={version.product_id === product.id}
                  />
                ))}
              </Box>
            </>
          ) : null}
        </Box>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
