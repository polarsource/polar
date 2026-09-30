import { invalidateMigrationRecords } from '@/hooks/queries/merchantMigrations'
import { useCallback, useRef, useState } from 'react'
import {
  effectiveTax,
  fetchAllSubscriptionRecords,
  isTaxEditable,
  patchRecordTax,
  runWithConcurrency,
  TaxBehavior,
  TaxRow,
} from './bulkTaxRecords'

const CONCURRENCY = 5

export interface BulkTaxFailure {
  row: TaxRow
  message: string
}

export type BulkTaxPhase = 'idle' | 'collecting' | 'running' | 'done'

export interface BulkTaxState {
  phase: BulkTaxPhase
  target: TaxBehavior | null
  total: number
  updated: number
  alreadySet: number
  failures: BulkTaxFailure[]
  error: string | null
}

const IDLE: BulkTaxState = {
  phase: 'idle',
  target: null,
  total: 0,
  updated: 0,
  alreadySet: 0,
  failures: [],
  error: null,
}

export type RowFilter = (row: TaxRow) => boolean

export function useBulkTaxUpdate(migrationId: string) {
  const [state, setState] = useState<BulkTaxState>(IDLE)
  const running = useRef(false)

  const apply = useCallback(
    async (
      target: TaxBehavior,
      rows: TaxRow[],
      progress: Pick<BulkTaxState, 'total' | 'updated' | 'alreadySet'>,
    ) => {
      setState({
        ...IDLE,
        phase: 'running',
        target,
        total: progress.total,
        updated: progress.updated,
        alreadySet: progress.alreadySet,
      })
      await runWithConcurrency(rows, CONCURRENCY, async (row) => {
        try {
          await patchRecordTax(migrationId, row.record_id as string, target)
          setState((prev) => ({ ...prev, updated: prev.updated + 1 }))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Something went wrong.'
          setState((prev) => ({
            ...prev,
            failures: [...prev.failures, { row, message }],
          }))
        }
      })
      setState((prev) => ({ ...prev, phase: 'done' }))
      invalidateMigrationRecords(migrationId)
    },
    [migrationId],
  )

  const start = useCallback(
    async (target: TaxBehavior, include: RowFilter = () => true) => {
      if (running.current) return
      running.current = true
      setState({ ...IDLE, phase: 'collecting', target })
      try {
        const candidates = (await fetchAllSubscriptionRecords(migrationId))
          .filter(isTaxEditable)
          .filter(include)
        const pending = candidates.filter((row) => effectiveTax(row) !== target)
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
          error:
            error instanceof Error && error.message
              ? error.message
              : "We couldn't load your subscriptions.",
        })
      } finally {
        running.current = false
      }
    },
    [apply, migrationId],
  )

  const retry = useCallback(async () => {
    if (running.current || !state.target || state.failures.length === 0) {
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
  }, [apply, state])

  const reset = useCallback(() => {
    if (!running.current) setState(IDLE)
  }, [])

  return {
    state,
    busy: state.phase === 'collecting' || state.phase === 'running',
    start,
    retry,
    reset,
  }
}

export type BulkTaxController = ReturnType<typeof useBulkTaxUpdate>
