'use client'

import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateCatalog } from '@/hooks/queries/catalogs'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Input, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Pencil } from '@polar-sh/orbit/icons'
import { useState } from 'react'

type Catalog = schemas['Catalog']

const RenameForm = ({
  catalog,
  onDone,
}: {
  catalog: Catalog
  onDone: () => void
}) => {
  const [name, setName] = useState(catalog.name ?? '')
  const update = useUpdateCatalog(catalog.id)
  const isDraft = catalog.status === 'draft'

  return (
    <Box
      as="form"
      flexDirection="column"
      rowGap="xl"
      padding="2xl"
      onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await update.mutateAsync({ name })
        if (error) {
          toast({
            title: 'Could not rename version',
            description: extractApiErrorMessage(error),
          })
          return
        }
        onDone()
      }}
    >
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Rename version
        </Text>
        <Text color="muted">
          {isDraft
            ? 'Leave empty to name it when it’s published.'
            : 'Only the label changes. Products and customers are unaffected.'}
        </Text>
      </Box>
      <Input
        autoFocus
        value={name}
        placeholder="Untitled"
        aria-label="Version name"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setName(e.target.value)}
      />
      <Box justifyContent="end" columnGap="s">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={update.isPending}
          disabled={!isDraft && !name.trim()}
        >
          Save
        </Button>
      </Box>
    </Box>
  )
}

export const VersionTitle = ({ catalog }: { catalog: Catalog }) => {
  const { isShown, show, hide } = useModal()

  return (
    <>
      <button
        type="button"
        title="Rename version"
        onClick={show}
        className="group min-w-0 cursor-pointer text-left"
      >
        <Box as="span" display="inline-flex" alignItems="center" columnGap="s">
          <Text variant="heading-xs" as="h1" truncate>
            {catalog.name ?? 'Untitled'}
          </Text>
          <span className="inline-flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Box as="span" display="inline-flex" color="text-secondary">
              <Pencil className="h-3.5 w-3.5" />
            </Box>
          </span>
        </Box>
      </button>
      <Modal
        title="Rename version"
        className="md:min-w-[400px] lg:max-w-[480px]"
        isShown={isShown}
        hide={hide}
        modalContent={<RenameForm catalog={catalog} onDone={hide} />}
      />
    </>
  )
}
