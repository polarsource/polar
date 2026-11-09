import { useCatalogVersionLabels } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, ChevronDown } from '@polar-sh/orbit/icons'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatPublishedAt } from './ProductPage/ProductVersionBanner'

export interface CatalogVersion {
  id: string
  catalog_id: string | null
  is_current: boolean
}

export const CatalogVersionSelect = ({
  organization,
  versions: items,
  selectedId,
  basePath,
}: {
  organization: schemas['Organization']
  versions: CatalogVersion[] | undefined
  selectedId: string
  basePath: string
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { data: catalogs } = useCatalogVersionLabels(organization)

  const versions = (items ?? [])
    .flatMap((version) => {
      const catalog = version.catalog_id && catalogs?.get(version.catalog_id)
      if (!catalog) return []
      return [
        {
          id: version.id,
          name: catalog.name ?? 'Untitled',
          publishedAt: catalog.published_at,
          date: formatPublishedAt(catalog.published_at),
          isCurrent: version.is_current,
          isDraft: catalog.status === 'draft',
        },
      ]
    })
    .sort(
      (a, b) =>
        Number(!b.publishedAt) - Number(!a.publishedAt) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
    )
  const selected = versions.find(({ id }) => id === selectedId)

  if (!selected) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            columnGap="xs"
          >
            <span>{selected.name}</span>
            <Text as="span" color="muted">
              ·{' '}
              {selected.isCurrent
                ? 'Current'
                : selected.isDraft
                  ? 'Draft'
                  : selected.date}
            </Text>
            <ChevronDown size={14} />
          </Box>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="dark:bg-polar-900 dark:border-polar-700 w-[280px] rounded-2xl p-0 shadow-xl"
      >
        <Command
          defaultValue={selected.id}
          className="rounded-2xl bg-transparent"
        >
          <CommandInput
            placeholder="Change version…"
            wrapperClassName="dark:border-polar-700 px-4 [&>svg]:hidden"
            className="h-10 border-0 px-0 text-sm focus:ring-0 focus:outline-0"
          />
          <CommandList className="max-h-[420px] p-1.5">
            <CommandEmpty>No versions found</CommandEmpty>
            {versions.map((version) => (
              <CommandItem
                key={version.id}
                value={version.id}
                keywords={[version.name, version.date]}
                onSelect={() => {
                  setOpen(false)
                  router.push(`${basePath}/${version.id}`)
                }}
                className="dark:data-[selected=true]:bg-polar-800 h-9 gap-3 rounded-lg px-2.5 data-[selected=true]:bg-gray-100 data-[selected=true]:text-inherit"
              >
                <Text truncate>{version.name}</Text>
                {version.isCurrent ? (
                  <Status status="Current" color="gray" size="small" />
                ) : version.isDraft ? (
                  <Status status="Draft" color="blue" size="small" />
                ) : null}
                <Box flex={1} />
                {version.id === selected.id ? (
                  <Check className="size-3.5!" />
                ) : null}
                <Text variant="caption" color="muted" wrap="nowrap" tabularNums>
                  {version.date}
                </Text>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
