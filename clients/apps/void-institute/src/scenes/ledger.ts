/**
 * A browser-side model of the SDK's local event buffer next to the server's
 * ledger. A recorded event sits in local storage until a server receipt
 * proves it was counted; a check merges what is still local into the
 * server's balance. Rejected events stop counting; old unconfirmed ones are
 * pruned by retention.
 */

export type RowState =
  /** In local storage, upload accepted, waiting for the worker and a receipt. */
  | 'local'
  /** Counted by the server; the receipt has removed the local copy. */
  | 'confirmed'
  /** Upload failed with a network error or a 5xx; still local, still counted. */
  | 'pending'
  /** Refused by the API with a 4xx; marked rejected and excluded from reads. */
  | 'rejected'
  /** Older than the retention window without a receipt; swept on the next write. */
  | 'pruned'

export interface Row {
  readonly id: string
  readonly amount: number
  readonly state: RowState
  readonly note?: string
}

export interface Reconciled {
  /** Remaining according to the server alone. */
  readonly remoteRemaining: number
  /** Remaining once local events are merged. */
  readonly remaining: number
  readonly localAdjustment: number
  readonly eventCount: number
  readonly applied: boolean
  readonly provisional: boolean
}

const counts = (state: RowState) => state === 'local' || state === 'pending'

export const reconcile = (
  rows: readonly Row[],
  credits: number,
  serverUsage: number,
): Reconciled => {
  const confirmed = rows
    .filter((row) => row.state === 'confirmed')
    .reduce((sum, row) => sum + row.amount, 0)
  const local = rows.filter((row) => counts(row.state))
  const localAdjustment = -local.reduce((sum, row) => sum + row.amount, 0)
  const remoteRemaining = credits - serverUsage - confirmed
  return {
    remoteRemaining,
    remaining: remoteRemaining + localAdjustment,
    localAdjustment,
    eventCount: local.length,
    applied: local.length > 0,
    provisional: local.length > 0,
  }
}

export const inLocalStorage = (row: Row) => row.state !== 'confirmed'
export const onServer = (row: Row) => row.state === 'confirmed'
