export interface SyncEvent {
  synced: number
  expected: number
  repository_id: string
}

export interface RepoSyncState extends SyncEvent {
  id: string
  avatar_url: string
  name: string
  completed: boolean
}
