export interface RetroactiveChanges {
  additions: number
  removals: number
}

export interface AllRetroactiveChanges {
  [id: string]: RetroactiveChanges
}
