import { parseAsBoolean, useQueryStates } from 'nuqs'

// The rail's controls live in the URL so they survive moving between features.
export const useRailState = () =>
  useQueryStates({
    all: parseAsBoolean.withDefault(false),
  })
