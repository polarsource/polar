'use client'

import { Button, DataTableColumnDef, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ExclusiveWarning } from './BulkTaxChoice'
import {
  applyLabel,
  BULK_TAX_SCOPE,
  TAX_DESCRIPTIONS,
  TAX_LABELS,
  TAX_OPTIONS,
} from './bulkTaxCopy'
import { BulkTaxProgress } from './BulkTaxProgress'
import {
  effectiveTax,
  isTaxEditable,
  needsTaxDecision,
  TaxBehavior,
  TaxRow,
} from './bulkTaxRecords'
import { useBulkTaxUpdate } from './useBulkTaxUpdate'

export function TaxCell({ row }: { row: TaxRow }) {
  if (!row.record_id || row.status === 'skipped') {
    return <Text color="muted">—</Text>
  }
  return (
    <Box alignItems="baseline" columnGap="xs">
      <Text color={isTaxEditable(row) ? 'default' : 'muted'}>
        {TAX_LABELS[effectiveTax(row)]}
      </Text>
      {needsTaxDecision(row) ? (
        <Text variant="caption" color="warning">
          unset
        </Text>
      ) : null}
    </Box>
  )
}

export function buildTaxColumn<T extends TaxRow>(
  migrationId: string,
  withMenu: boolean,
): DataTableColumnDef<T> {
  return {
    id: 'tax',
    size: 150,
    header: () =>
      withMenu ? (
        <TaxHeaderMenu migrationId={migrationId} />
      ) : (
        <Text variant="caption" color="muted">
          Tax
        </Text>
      ),
    cell: ({ row }) => <TaxCell row={row.original} />,
  }
}

function TaxHeaderMenu({ migrationId }: { migrationId: string }) {
  const controller = useBulkTaxUpdate(migrationId)
  const [target, setTarget] = useState<TaxBehavior | null>(null)
  const close = () => {
    if (controller.busy) return
    setTarget(null)
    controller.reset()
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => event.stopPropagation()}
          >
            <Box
              as="span"
              display="inline-flex"
              alignItems="center"
              columnGap="xs"
            >
              Tax
              <ChevronDown size={14} />
            </Box>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TAX_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTarget(option.value)}
            >
              {applyLabel(option.value)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Modal
        title={target ? `${applyLabel(target)}?` : ''}
        isShown={target !== null}
        hide={close}
        modalContent={
          target ? (
            <Box flexDirection="column" rowGap="l" padding="xl">
              <Text color="muted">
                {TAX_DESCRIPTIONS[target]} {BULK_TAX_SCOPE}
              </Text>
              {target === 'exclusive' ? <ExclusiveWarning /> : null}
              <BulkTaxProgress controller={controller} />
              <Box justifyContent="end" columnGap="s">
                <Button
                  variant="ghost"
                  onClick={close}
                  disabled={controller.busy}
                >
                  {controller.state.phase === 'done' ? 'Close' : 'Cancel'}
                </Button>
                {controller.state.phase === 'idle' ? (
                  <Button onClick={() => controller.start(target)}>
                    {applyLabel(target)}
                  </Button>
                ) : null}
              </Box>
            </Box>
          ) : (
            <Box />
          )
        }
      />
    </>
  )
}
