import {
  fetchAllMigrationRecords,
  invalidateMigrationRecords,
  updateMigrationRecord,
} from '@/hooks/queries/merchantMigrations'
import { runBulk } from '@/utils/bulk'
import { useCallback, useRef, useState } from 'react'
import {
  EditableTaxRow,
  isTaxEditable,
  needsTaxUpdate,
  TaxBehavior,
} from './bulkTaxRecords'

const CONCURRENCY = 5

interface BulkTaxFailure {
  row: EditableTaxRow
  message: string
}

type BulkTaxPhase = 'idle' | 'collecting' | 'running' | 'done'

export interface BulkTaxState {
  phase: BulkTaxPhase
  target: TaxBehavior | null
  total: number
  settled: number
  updated: number
  alreadySet: number
  failures: BulkTaxFailure[]
  error: string | null
}

const IDLE: BulkTaxState = {
  phase: 'idle',
  target: null,
  total: 0,
  settled: 0,
  updated: 0,
  alreadySet: 0,
  failures: [],
  error: null,
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export function useBulkTaxUpdate(migrationId: string) {
  const [state, setState] = useState<BulkTaxState>(IDLE)
  const running = useRef(false)

  const apply = useCallback(
    async (
      target: TaxBehavior,
      rows: EditableTaxRow[],
      progress: Pick<BulkTaxState, 'total' | 'updated' | 'alreadySet'>,
    ) => {
      setState({
        ...IDLE,
        phase: 'running',
        target,
        total: progress.total,
        settled: progress.updated,
        updated: progress.updated,
        alreadySet: progress.alreadySet,
      })
      const result = await runBulk(
        rows,
        async (row) => {
          try {
            await updateMigrationRecord(migrationId, row.record_id, {
              tax_behavior: target,
            })
          } finally {
            setState((prev) => ({ ...prev, settled: prev.settled + 1 }))
          }
        },
        { concurrency: CONCURRENCY },
      )
      setState((prev) => ({
        ...prev,
        phase: 'done',
        updated: prev.updated + result.succeeded.length,
        failures: result.failed.map(({ item, error }) => ({
          row: item,
          message: errorMessage(error, 'Something went wrong.'),
        })),
      }))
      invalidateMigrationRecords(migrationId)
    },
    [migrationId],
  )

  const start = useCallback(
    async (target: TaxBehavior) => {
      if (running.current) return
      running.current = true
      setState({ ...IDLE, phase: 'collecting', target })
      try {
        const candidates = (
          await fetchAllMigrationRecords(migrationId, 'subscriptions')
        ).filter(isTaxEditable)
        const pending = candidates.filter((row) => needsTaxUpdate(row, target))
        await apply(target, pending, {
          total: pending.length,
          updated: 0,
          alreadySet: candidates.length - pending.length,
        })
      } catch (error) {
        setState({
          ...IDLE,
          phase: 'done',
          target,
          error: errorMessage(error, 'Something went wrong. Please try again.'),
        })
      } finally {
        running.current = false
      }
    },
    [apply, migrationId],
  )

  const retry = useCallback(async () => {
    if (running.current || !state.target) {
      return
    }
    if (state.error) {
      await start(state.target)
      return
    }
    running.current = true
    try {
      await apply(
        state.target,
        state.failures.map((failure) => failure.row),
        state,
      )
    } finally {
      running.current = false
    }
  }, [apply, start, state])

  const reset = useCallback(() => setState(IDLE), [])

  return {
    state,
    busy: state.phase === 'collecting' || state.phase === 'running',
    start,
    retry,
    reset,
  }
}

export type BulkTaxController = ReturnType<typeof useBulkTaxUpdate>
